import Link from 'next/link'

export default function Page() {
  return (
    <div className="flex flex-col items-center mt-40">
      <h1 className="font-bold">Punctual</h1>
      <Link href="/sign-in">Sign in</Link>
      <Link href="/sign-up">Sign up</Link>
    </div>
  )
}