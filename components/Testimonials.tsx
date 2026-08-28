"use client";

import { useEffect, useMemo, useState } from "react";
import Underline from "./ui/Underline";

type TestimonialsProps = {
  title: string;
  variant?: "student" | "teacher";
  teacherReviews?: TeacherCard[];
};

type ReviewCard = {
  id: string;
  image: string;
  name: string;
  handle: string;
  message: string;
  rating: number;
  _uid?: string;
};

type TeacherCard = {
  id: string;
  name: string;
  qualification: string;
  experience: number;
  message: string;
  _uid?: string;
};

const Testimonials = ({
  title,
  variant = "student",
  teacherReviews = [],
}: TestimonialsProps) => {
  const [cardsData, setCardsData] = useState<ReviewCard[]>([]);

  useEffect(() => {
    if (variant !== "student") return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/reviews?public=1&limit=20", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();

        const mapped: ReviewCard[] = (data.reviews ?? []).map((r: any) => ({
          id: r.id,
          image: r.user.imageUrl || `https://api.dicebear.com/5.x/initials/svg?seed=${r.user.name}`,
          name: r.user.name,
          handle: `@${r.user.username}`,
          message: r.message,
          rating: r.rating,
        }));

        if (!cancelled) setCardsData(mapped);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [variant]);

  const displayData = useMemo(() => {
    const source = variant === "student" ? cardsData : teacherReviews;

    return source.flatMap((card: any, i: number) => [
      { ...card, _uid: `${card.id}-a-${i}` },
      { ...card, _uid: `${card.id}-b-${i}` },
    ]);
  }, [cardsData, teacherReviews, variant]);

  const StudentCard = ({ card }: { card: ReviewCard }) => (
    <div className="w-72 shrink-0 rounded-xl bg-white p-4 shadow transition hover:shadow-lg">
      <div className="flex gap-3">
        <img src={card.image} className="h-11 w-11 rounded-full object-cover" />

        <div>
          <h3 className="font-semibold">{card.name}</h3>

          <p className="text-xs text-gray-500">{card.handle}</p>
        </div>
      </div>

      <p className="mt-4 line-clamp-4 text-sm text-gray-700">{card.message}</p>

      <div className="mt-3 flex">
        {Array.from({ length: card.rating }).map((_, i) => (
          <span key={i}>⭐</span>
        ))}
      </div>
    </div>
  );

  const TeacherReviewCard = ({ card }: { card: TeacherCard }) => (
    <div className="w-80 shrink-0 rounded-2xl border border-green-100 bg-linear-to-br from-green-50 to-white p-5 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-4">
        <div>
          <h3 className="text-lg font-bold">{card.name}</h3>
          <p className="text-sm font-medium text-green-600">
            {card.qualification}
          </p>
          <span className="inline-block mt-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            {card.experience} Years Experience
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-gray-700 line-clamp-5">
        "{card.message}"
      </p>
    </div>
  );
  return (
    <>
      <style>{`
            @keyframes marqueeScroll {
                0% { transform: translateX(0%); }
                100% { transform: translateX(-50%); }
            }

            .marquee-inner {
                animation: marqueeScroll 25s linear infinite;
            }

            .marquee-reverse {
                animation-direction: reverse;
            }
        `}</style>
      <div className="my-5 md:my-10 w-full">
        <Underline
          title={title}
          className="text-center"
          color="green"
          size="large"
        />
        <div className="w-full">
          <div className="marquee-row w-full mx-auto max-w-5xl overflow-hidden relative">
            <div className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none bg-linear-to-r from-white dark:from-black to-transparent"></div>
            <div className="marquee-inner flex transform-gpu py-5 gap-10">
              {displayData.map((card: any) =>
                variant === "student" ? (
                  <StudentCard key={`row1-${card._uid}`} card={card} />
                ) : (
                  <TeacherReviewCard key={`row1-${card._uid}`} card={card} />
                ),
              )}
            </div>
            <div className="absolute right-0 top-0 h-full w-20 z-10 pointer-events-none bg-linear-to-l from-white dark:from-black to-transparent"></div>
          </div>

          <div className="marquee-row w-full mx-auto max-w-5xl overflow-hidden relative">
            <div className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none bg-linear-to-r from-white dark:from-black to-transparent"></div>
            <div className="marquee-inner marquee-reverse flex transform-gpu py-5 gap-10">
              {displayData.map((card: any) =>
                variant === "student" ? (
                  <StudentCard key={`row1-${card._uid}`} card={card} />
                ) : (
                  <TeacherReviewCard key={`row1-${card._uid}`} card={card} />
                ),
              )}
            </div>
            <div className="absolute right-0 top-0 h-full w-20 z-10 pointer-events-none bg-linear-to-l from-white dark:from-black to-transparent"></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Testimonials;
