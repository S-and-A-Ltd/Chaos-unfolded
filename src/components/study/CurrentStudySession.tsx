'use client';

export default function CurrentStudySession() {
  return (
    <div className="w-full glass-card-pink-static p-6 shadow-[0_6px_0_#7c6a75] flex flex-col gap-4 font-fredoka">
      <div className="text-lg font-black uppercase tracking-widest text-[#5d5770] border-b-2 border-[#7c6a75]/25 pb-3 text-center">
        Current Study Session
      </div>
      <div className="text-sm font-black text-[#5d5770]/70 text-center py-4">
        Session data will appear here...
      </div>
    </div>
  );
}
