// frontend/src/StudentPortal.jsx
// Redirects /student/:slug to the library page with student login open
export default function StudentPortal() {
  const slug = window.location.pathname.split('/student/')[1]?.split('/')[0] || '';
  if (slug) window.location.replace(`/lib/${slug}?view=student`);
  return null;
}
