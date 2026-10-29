import Nav from "./Nav";
const Account = ({ email }: { email: string }) => (
  <div className="mt-6 border-t border-[#e6dfd0] pt-4 text-sm">
    <p className="truncate text-[#55667a]">{email}</p>
    <form action="/api/auth/logout?to=/admin/login" method="post"><button className="mt-2 min-h-[40px] rounded-full border border-[#12263F] px-4 font-semibold">Log out</button></form>
  </div>
);
export default function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBF7EF] text-[#12263F] md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <aside className="hidden w-64 shrink-0 border-r border-[#e6dfd0] bg-white p-5 md:block"><p className="font-serif text-2xl">AHLI <span className="text-sm text-[#B8902F]">Admin</span></p><Nav /><Account email={email} /></aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-[#e6dfd0] bg-white px-4 py-2 md:hidden">
          <p className="font-serif text-xl">AHLI Admin</p>
          <details className="relative"><summary className="flex min-h-[44px] cursor-pointer items-center px-3 font-semibold">Menu</summary>
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-[#e6dfd0] bg-white p-4 shadow"><Nav /><Account email={email} /></div></details>
        </header>
        <main id="main" className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
