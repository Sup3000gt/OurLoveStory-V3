-- Replace these placeholders with the two Clerk user IDs and real email addresses.
INSERT INTO owners (clerk_user_id, email, display_name)
VALUES
  ('user_REPLACE_ALAN', 'alan@example.com', 'Alan'),
  ('user_REPLACE_WIFE', 'wife@example.com', 'Wife')
ON CONFLICT(clerk_user_id) DO UPDATE SET
  email = excluded.email,
  display_name = excluded.display_name;
