export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 mb-30">
      {/* <div className="inline-block text-center justify-center"> */}
      {/* Your content here */}
      {children}
      {/* </div> */}
    </section>
  );
}
