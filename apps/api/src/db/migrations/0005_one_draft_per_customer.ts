import { type Kysely, sql } from 'kysely';

// One open draft per customer, so "the current draft" means exactly one thing
// (resume banner, wizard, AI assistant). The database enforces it, so two
// "Reservar" clicks at the same time can't create two drafts.
export async function up(db: Kysely<unknown>): Promise<void> {
  // Databases created before this rule may hold several drafts per customer.
  // Keep each customer's most recent one; cancel the rest with a reason.
  await sql`
    UPDATE bookings
    SET status = 'cancelled',
        cancel_reason = 'Borrador reemplazado por uno más reciente',
        cancelled_at = now(),
        updated_at = now()
    WHERE status = 'draft'
      AND id NOT IN (
        SELECT DISTINCT ON (customer_id) id
        FROM bookings
        WHERE status = 'draft'
        ORDER BY customer_id, updated_at DESC, created_at DESC
      )
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX one_draft_per_customer ON bookings (customer_id) WHERE status = 'draft'
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX one_draft_per_customer`.execute(db);
}
