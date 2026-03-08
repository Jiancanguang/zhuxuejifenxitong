import React from 'react';

export const MysteriousEgg = () => {
    return (
        <div className="relative w-full h-full flex items-center justify-center group">
            {/* 呼吸光晕 */}
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-200 via-purple-200 to-pink-200 rounded-full blur-xl opacity-40 animate-pulse group-hover:opacity-70 transition-opacity" />

            {/* 蛋体 */}
            <svg
                viewBox="0 0 100 130"
                className="w-[80%] h-[80%] drop-shadow-xl transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-2 group-hover:rotate-3"
            >
                <defs>
                    <linearGradient id="eggGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fff" />
                        <stop offset="50%" stopColor="#f3e8ff" />
                        <stop offset="100%" stopColor="#e9d5ff" />
                    </linearGradient>
                    <pattern id="starPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill="#d8b4fe" fillOpacity="0.4" transform="scale(0.3)" />
                    </pattern>
                </defs>

                {/* 外形 */}
                <path
                    d="M50 5 C 20 5, 5 45, 5 80 C 5 110, 25 125, 50 125 C 75 125, 95 110, 95 80 C 95 45, 80 5, 50 5 Z"
                    fill="url(#eggGradient)"
                    stroke="#fff"
                    strokeWidth="2"
                />

                {/* 花纹覆盖 */}
                <path
                    d="M50 5 C 20 5, 5 45, 5 80 C 5 110, 25 125, 50 125 C 75 125, 95 110, 95 80 C 95 45, 80 5, 50 5 Z"
                    fill="url(#starPattern)"
                    className="opacity-50"
                />

                {/* 高光 */}
                <ellipse cx="35" cy="35" rx="10" ry="15" fill="white" fillOpacity="0.6" transform="rotate(-20 35 35)" />

                {/* 问号 - 使用自定义轻微浮动动画 */}
                <style>{`
                    @keyframes gentle-float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-3px); }
                    }
                `}</style>
                <text
                    x="50"
                    y="85"
                    fontSize="40"
                    fontWeight="900"
                    fill="#c084fc"
                    textAnchor="middle"
                    style={{
                        filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))',
                        animation: 'gentle-float 3s ease-in-out infinite'
                    }}
                >
                    ?
                </text>
            </svg>

            {/* 悬浮提示文字 */}
            <div className="absolute -bottom-2 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-black text-purple-600 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-sm border border-purple-100">
                点击领养
            </div>
        </div>
    );
};
