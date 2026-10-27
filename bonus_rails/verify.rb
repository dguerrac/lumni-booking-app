# Verifica el análisis del Bonus Rails contra ActiveRecord + PostgreSQL reales.
# Uso: DATABASE_URL=postgres://lumni:lumni@localhost:5433/rails_bonus ruby bonus_rails/verify.rb
require "bundler/inline" unless defined?(ActiveRecord)
unless defined?(ActiveRecord)
  gemfile do
    source "https://rubygems.org"
    gem "activerecord", "8.0.2"
    gem "pg"
  end
end
require "active_record"

ActiveRecord::Base.establish_connection(ENV.fetch("DATABASE_URL"))
ActiveRecord::Migration.verbose = false

$failures = 0
def check(label)
  ok = yield
  $failures += 1 unless ok
  puts "#{ok ? 'PASS' : 'FAIL'}  #{label}"
end

module TaxCalculator
  class << self
    attr_accessor :rate # nil simula una falla del cálculo
    def for(booking) = rate && booking.lines_total * rate / 100
  end
end

ActiveRecord::Schema.define do
  %i[original fixed status_changed rescued].each do |v|
    create_table "#{v}_bookings", force: true do |t|
      t.string :status, null: false, default: "draft"
      t.string :notes
      t.integer :lines_total, null: false
      t.timestamps
    end
    create_table "#{v}_invoices", force: true do |t|
      t.bigint :booking_id, null: false
      t.integer :total, null: false
      t.integer :tax, null: false
    end
  end
  %i[fixed status_changed rescued].each { |v| add_index "#{v}_invoices", :booking_id, unique: true }
end

def invoice_class(prefix)
  Class.new(ActiveRecord::Base) do
    self.table_name = "#{prefix}_invoices"
    validates :tax, presence: true
  end
end

# --- Modelo original del enunciado ---
OriginalInvoice = invoice_class(:original)
class OriginalBooking < ActiveRecord::Base
  has_one :invoice, class_name: "OriginalInvoice", foreign_key: :booking_id, dependent: :destroy
  before_save :regenerate_invoice, if: -> { status == "confirmed" }
  def regenerate_invoice
    invoice&.destroy
    build_invoice(total: lines_total, tax: TaxCalculator.for(self))
  end
end

# --- Corrección propuesta ---
FixedInvoice = invoice_class(:fixed)
class FixedBooking < ActiveRecord::Base
  has_one :invoice, class_name: "FixedInvoice", foreign_key: :booking_id
  after_save :issue_invoice, if: -> { saved_change_to_status?(from: "draft", to: "confirmed") }
  private
  def issue_invoice
    FixedInvoice.create_or_find_by!(booking_id: id) do |invoice|
      invoice.total = lines_total
      invoice.tax = TaxCalculator.for(self)
    end
  end
end

# --- Correcciones equivocadas ---
StatusChangedInvoice = invoice_class(:status_changed)
class StatusChangedBooking < ActiveRecord::Base
  after_save :issue_invoice, if: -> { status_changed? && status == "confirmed" }
  def issue_invoice = StatusChangedInvoice.create!(booking_id: id, total: lines_total, tax: TaxCalculator.for(self))
end

RescuedInvoice = invoice_class(:rescued)
class RescuedBooking < ActiveRecord::Base
  after_save :issue_invoice, if: -> { saved_change_to_status?(to: "confirmed") }
  def issue_invoice
    RescuedInvoice.create!(booking_id: id, total: lines_total, tax: TaxCalculator.for(self))
  rescue ActiveRecord::RecordNotUnique
    nil # "ya existe, seguimos"
  end
end

puts "ActiveRecord #{ActiveRecord.version} · #{ActiveRecord::Base.connection.select_value('select version()')[/PostgreSQL [\d.]+/]}"

puts "\n== Original =="
TaxCalculator.rate = 19
b = OriginalBooking.create!(lines_total: 100)
b.update!(status: "confirmed")
first = b.reload.invoice
check("confirmar crea la factura (100 + 19)") { first && [first.total, first.tax] == [100, 19] }
b.update_column(:lines_total, 120)
TaxCalculator.rate = 25
b.reload.update!(notes: "llega 10 min tarde")
second = b.reload.invoice
check("editar las notas reemplaza la factura (id nuevo)") { second.id != first.id && !OriginalInvoice.exists?(first.id) }
check("editar las notas recalcula el precio pactado (120 + 30)") { [second.total, second.tax] == [120, 30] }
b.touch
check("touch no dispara before_save") { b.reload.invoice.id == second.id }

TaxCalculator.rate = nil
result = b.reload.update(notes: "otra nota")
check("si la factura nueva es inválida, save devuelve true") { result == true }
check("... y la reserva queda confirmada sin ninguna factura") { b.reload.status == "confirmed" && OriginalInvoice.where(booking_id: b.id).none? }

TaxCalculator.rate = 19
c = OriginalBooking.create!(lines_total: 100, status: "confirmed")
s1 = OriginalBooking.find(c.id)
s2 = OriginalBooking.find(c.id)
s1.invoice; s2.invoice # ambas instancias cargan la misma factura
s1.update!(notes: "a")
s2.update!(notes: "b")
check("dos guardados con instancias viejas dejan 2 facturas") { OriginalInvoice.where(booking_id: c.id).count == 2 }

puts "\n== Corregido =="
TaxCalculator.rate = 19
f = FixedBooking.create!(lines_total: 100)
stale = FixedBooking.find(f.id)
f.update!(status: "confirmed")
inv = FixedInvoice.find_by!(booking_id: f.id)
check("confirmar crea una factura (100 + 19)") { [inv.total, inv.tax] == [100, 19] }
TaxCalculator.rate = 25
f.update_column(:lines_total, 120)
f.reload.update!(notes: "llega tarde")
check("editar después no toca la factura aunque cambie el IVA") { FixedInvoice.where(booking_id: f.id).pluck(:id, :total, :tax) == [[inv.id, 100, 19]] }
check("un segundo confirm con instancia vieja no falla") { stale.update!(status: "confirmed") }
check("... y sigue habiendo una sola factura") { FixedInvoice.where(booking_id: f.id).count == 1 }

TaxCalculator.rate = nil
g = FixedBooking.create!(lines_total: 100)
raised = begin; g.update!(status: "confirmed"); false; rescue ActiveRecord::RecordInvalid; true; end
check("si la factura falla, confirm lanza error") { raised }
check("... y la reserva sigue en draft") { g.reload.status == "draft" && FixedInvoice.where(booking_id: g.id).none? }

puts "\n== Correcciones equivocadas =="
TaxCalculator.rate = 19
h = StatusChangedBooking.create!(lines_total: 100)
h.update!(status: "confirmed")
check("status_changed? en after_save nunca dispara (no hay factura)") { StatusChangedInvoice.where(booking_id: h.id).none? }

r = RescuedBooking.create!(lines_total: 100)
RescuedInvoice.create!(booking_id: r.id, total: 1, tax: 1) # ya existe una factura
r.status = "confirmed"
saved = r.save
check("rescue RecordNotUnique: save devuelve true...") { saved == true }
check("... pero no se guardó nada (el COMMIT fue ROLLBACK)") { RescuedBooking.find(r.id).status == "draft" }

puts "\n#{$failures.zero? ? 'Todo verificado' : "#{$failures} fallas"}"
exit($failures.zero? ? 0 : 1)
