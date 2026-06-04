import { redirect } from 'next/navigation';

// Redirect root to the only active product in v1.
export default function HomePage() {
  redirect('/lose-weight-challenge-1st-edition');
}
