export function ProcessArt({ kind }: { kind: "browse" | "drive" | "next" }) {
  return (
    <svg viewBox="0 0 360 230" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="180" cy="207" rx="145" ry="12" fill="#DFEBE4" />
      <circle cx="188" cy="107" r="93" fill="#F2F6EE" />
      <g
        stroke="#193B42"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "browse" ? (
          <>
            <rect
              x="137"
              y="35"
              width="179"
              height="130"
              rx="13"
              fill="#FFFDF7"
            />
            <path d="M137 57h179" />
            <circle cx="149" cy="46" r="2" fill="#D6A85A" stroke="none" />
            <circle cx="159" cy="46" r="2" fill="#83B6A0" stroke="none" />
            {[75, 115].map((y) => (
              <g key={y}>
                <rect
                  x="150"
                  y={y}
                  width="47"
                  height="30"
                  rx="5"
                  fill="#A5CEBA"
                />
                <path
                  d={`M208 ${y + 5}h88m-88 10h63m-63 10h38`}
                  strokeWidth="2"
                />
              </g>
            ))}
            <path
              d="M34 205v-32q0-38 40-38h24q35 0 42 38l5 32"
              fill="#80B39C"
            />
            <path d="M74 139v-14h26v14q-12 16-26 0Z" fill="#EAB38D" />
            <rect x="60" y="69" width="53" height="65" rx="25" fill="#F2C7A3" />
            <path
              d="M60 98V80q0-25 28-26 26 0 28 28-20-1-29-14-3 24-27 30Z"
              fill="#193B42"
            />
            <circle cx="78" cy="103" r="2" fill="#193B42" stroke="none" />
            <circle cx="99" cy="103" r="2" fill="#193B42" stroke="none" />
            <path d="M82 115q7 5 13 0" />
            <rect
              x="110"
              y="144"
              width="31"
              height="49"
              rx="5"
              fill="#F1C66E"
              transform="rotate(-12 110 144)"
            />
            <path
              d="m65 166 19 26q8 8 18 0l17-14"
              strokeWidth="13"
              stroke="#F2C7A3"
            />
            <path d="m65 166 19 26q8 8 18 0l17-14" strokeWidth="2" />
            <path d="m301 19 4-8m15 18 8-2M31 70l-7-5" />
          </>
        ) : kind === "drive" ? (
          <>
            <path
              d="m73 128 31-51q6-9 17-9h93q14 0 23 12l37 48"
              fill="#F0C16C"
            />
            <path d="m99 119 24-39h82v39Zm119-39 29 39h-29Z" fill="#FFFCF1" />
            <path
              d="M185 119v-16q0-12-15-12h-13q-14 0-14 12v16"
              fill="#83B6A0"
            />
            <circle cx="164" cy="84" r="16" fill="#F2C7A3" />
            <path
              d="M148 84q-5-23 16-23 18 1 18 19-18 0-24-10-2 9-10 14Z"
              fill="#193B42"
            />
            <path d="M167 88q4 3 7-1" strokeWidth="2" />
            <circle cx="174" cy="81" r="1.5" fill="#193B42" stroke="none" />
            <path d="m175 109 18 5" stroke="#F2C7A3" strokeWidth="8" />
            <circle cx="199" cy="111" r="12" />
            <path
              d="M63 126h219q17 0 20 19l4 30q-1 10-11 10H60q-14 0-14-13v-25q0-21 17-21Z"
              fill="#7EAF9B"
            />
            <circle cx="99" cy="183" r="23" fill="#193B42" />
            <circle cx="99" cy="183" r="12" fill="#FFF9ED" />
            <circle cx="254" cy="183" r="23" fill="#193B42" />
            <circle cx="254" cy="183" r="12" fill="#FFF9ED" />
            <path d="M138 148h14m60 0h14m-57 0v20" />
            <path d="M48 143h18v14H48m238-14h15" fill="#F0C16C" />
            <path d="M29 153H14m25 19H20m69-132q80-27 154 0m-8-10 10 11-15 3" />
          </>
        ) : (
          <>
            <path d="M39 205v-33q0-35 37-35h25q36 0 37 35v33" fill="#F0C16C" />
            <path d="M75 139v-14h25v14q-11 14-25 0Z" fill="#EAB38D" />
            <rect x="60" y="68" width="54" height="66" rx="26" fill="#F2C7A3" />
            <path
              d="M60 99V81q0-27 28-27 28 0 29 28-20-1-31-13-3 23-26 30Z"
              fill="#193B42"
            />
            <circle cx="78" cy="103" r="2" fill="#193B42" stroke="none" />
            <circle cx="101" cy="103" r="2" fill="#193B42" stroke="none" />
            <path d="M81 115q8 7 16 0" />
            <rect
              x="159"
              y="34"
              width="131"
              height="78"
              rx="16"
              fill="#FFFDF7"
            />
            <path d="m179 112-11 17v-19m18-52h76m-76 16h57" />
            <path d="m181 161 14-26h74l17 26" fill="#F0C16C" />
            <rect
              x="174"
              y="159"
              width="120"
              height="36"
              rx="10"
              fill="#83B6A0"
            />
            <circle cx="196" cy="195" r="12" fill="#193B42" />
            <circle cx="274" cy="195" r="12" fill="#193B42" />
            <path d="M183 173h13m77 0h12m-64 3h27" />
            <path d="m121 152 17 13" stroke="#F2C7A3" strokeWidth="12" />
            <path d="m121 152 17 13" strokeWidth="2" />
            <path d="m304 91 6-7m-1 34 10 1M42 39l-5-7" />
          </>
        )}
      </g>
    </svg>
  );
}
