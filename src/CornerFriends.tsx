type Friend = "bear" | "penguin" | "pork" | "cat" | "lizard";
const fills: Record<Friend, string> = {
  bear: "#fffdf5",
  penguin: "#c8d8ac",
  pork: "#dcb897",
  cat: "#f0ddb0",
  lizard: "#b8d5df",
};
/** Small original SVG interpretations for the cozy theme; no remote assets. */
export function CornerFriend({
  kind = "bear",
  className = "",
}: {
  kind?: Friend;
  className?: string;
}) {
  const cat = kind === "cat",
    bear = kind === "bear";
  return (
    <svg
      className={`corner-friend ${className}`}
      viewBox="0 0 100 108"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="50" cy="101" rx="30" ry="4" fill="#91816d" opacity=".13" />
      {bear && (
        <>
          <circle
            cx="29"
            cy="25"
            r="10"
            fill={fills[kind]}
            stroke="#796b60"
            strokeWidth="2"
          />
          <circle
            cx="70"
            cy="25"
            r="10"
            fill={fills[kind]}
            stroke="#796b60"
            strokeWidth="2"
          />
          <circle cx="29" cy="25" r="5" fill="#f1d9ce" />
          <circle cx="70" cy="25" r="5" fill="#f1d9ce" />
        </>
      )}
      {cat && (
        <path
          d="M21 35 23 12 40 27M61 26 78 12 80 36"
          fill={fills[kind]}
          stroke="#796b60"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      <path
        d="M18 65C16 39 25 22 50 22S83 39 82 65L83 83Q83 98 67 98H33Q17 98 17 83Z"
        fill={fills[kind]}
        stroke="#796b60"
        strokeWidth="2"
      />
      {kind === "pork" && (
        <path
          d="m25 45 3-2m7-9 2 2m12-5 3 1m18 8-2 2m7 19-3 1m-45 16 2 2m39 7 2-2m-21 6 2 1"
          fill="none"
          stroke="#be9470"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {cat && <path d="M63 24q15 3 18 21-13 6-21-5Z" fill="#c6a582" />}
      {kind === "penguin" && (
        <ellipse cx="50" cy="79" rx="21" ry="16" fill="#eef0d6" />
      )}
      {kind === "lizard" && (
        <ellipse cx="50" cy="81" rx="20" ry="14" fill="#e7f0ec" />
      )}
      <circle cx="39" cy="54" r="2.5" fill="#62584f" />
      <circle cx="61" cy="54" r="2.5" fill="#62584f" />
      {kind === "penguin" ? (
        <ellipse
          cx="50"
          cy="62"
          rx="6"
          ry="4"
          fill="#edd79c"
          stroke="#796b60"
          strokeWidth="1.3"
        />
      ) : kind === "pork" ? (
        <ellipse cx="50" cy="63" rx="6" ry="4" fill="#f2bdb5" />
      ) : (
        <>
          <ellipse cx="50" cy="62" rx="3" ry="2.3" fill="#796b60" />
          <path
            d="M50 64v3"
            stroke="#796b60"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
      <ellipse cx="31" cy="63" rx="5" ry="2.8" fill="#eabbb3" opacity=".7" />
      <ellipse cx="69" cy="63" rx="5" ry="2.8" fill="#eabbb3" opacity=".7" />
      {cat && (
        <path
          d="M22 58h7m-8 6h7m44-6h7m-7 6h8"
          stroke="#796b60"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      <path
        d="M22 78q5 6 9 1m38 0q5 5 9-1"
        stroke="#796b60"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M36 97q-4-7 4-7m24 7q4-7-4-7"
        stroke="#796b60"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function CornerFriends() {
  return (
    <div className="corner-friends" aria-hidden="true">
      {(["bear", "penguin", "pork", "cat", "lizard"] as Friend[]).map(
        (kind) => (
          <CornerFriend key={kind} kind={kind} />
        ),
      )}
    </div>
  );
}
