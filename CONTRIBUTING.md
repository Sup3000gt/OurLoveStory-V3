# Development workflow

- Work on a feature branch; do not implement directly on `main`.
- Run `npm run check` and `npm run build` before opening or merging a pull request.
- Add tests before changing validation, access-control, or upload behavior.
- Never commit Clerk secrets, R2 credentials, `.dev.vars`, `.env.local`, `database/owners.local.sql`, private family media, or production database exports.
- Keep the R2 bucket private and enforce visibility in the Worker, not only in React.
- Treat presigned URLs as temporary bearer credentials and keep their lifetime short.
