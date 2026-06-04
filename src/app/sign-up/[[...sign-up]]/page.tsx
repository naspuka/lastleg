import { SignUp } from "@clerk/nextjs";

// Companion to /sign-in — handles new account creation. Clerk routes between
// the two when the user clicks "Already have an account?" / "Need an
// account?". The middleware doesn't gate /sign-up; both routes are public.
export default function SignUpPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-12">
      <SignUp />
    </main>
  );
}
