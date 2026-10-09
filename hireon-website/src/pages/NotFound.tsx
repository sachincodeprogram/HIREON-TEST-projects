import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="container" style={{ padding: '96px 24px', textAlign: 'center' }}>
      <p className="eyebrow">404</p>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Page not found</h1>
      <p style={{ color: 'var(--text-soft)', marginBottom: 24 }}>
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="btn btn-primary">Back to Home</Link>
    </div>
  )
}

export default NotFound
