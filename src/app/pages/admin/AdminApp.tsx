// Admin panel (next step). Placeholder so the route exists.
import { Link } from 'react-router-dom';

export default function AdminApp() {
  return (
    <main className="container page" style={{ paddingTop: 120 }}>
      <h1>لوحة الإدارة</h1>
      <p>قيد الإنشاء.</p>
      <Link className="btn btn-primary" to="/account/profile">بياناتي</Link>
    </main>
  );
}
