import { useState, useEffect, useMemo, useCallback } from 'react';
import { I18nProvider, useI18n } from './i18n';
import {
  fetchDashboardData,
  Student,
  WEEKS,
  TOTAL_DAYS,
  isWeeklySuccess,
  getWeeklySuccessStudents,
  getWeekStatus,
  formatDeadline,
  getStudentWeekCompletedDays,
  getWeekTotalDays,
  REPO_OWNER,
  REPO_NAME,
} from './api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ============ Color utilities ============
const WEEK_COLORS = [
  { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'text-orange-600', bar: '#fb923c', gradient: 'from-orange-400 to-amber-500', light: 'bg-orange-100' },
  { bg: 'bg-rose-50', border: 'border-rose-200', accent: 'text-rose-600', bar: '#fb7185', gradient: 'from-rose-400 to-pink-500', light: 'bg-rose-100' },
  { bg: 'bg-violet-50', border: 'border-violet-200', accent: 'text-violet-600', bar: '#a78bfa', gradient: 'from-violet-400 to-purple-500', light: 'bg-violet-100' },
  { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-600', bar: '#fbbf24', gradient: 'from-amber-400 to-yellow-500', light: 'bg-amber-100' },
];

function getHeatColor(ratio: number): string {
  if (ratio === 0) return 'bg-gray-100 text-gray-400';
  if (ratio < 0.25) return 'bg-emerald-100 text-emerald-700';
  if (ratio < 0.5) return 'bg-emerald-200 text-emerald-800';
  if (ratio < 0.75) return 'bg-emerald-300 text-emerald-900';
  return 'bg-emerald-400 text-white';
}

// ============ Loading Component ============
function LoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-warm-pattern">
      <div className="text-center">
        <div className="text-6xl mb-6 animate-float">📚</div>
        <div className="flex justify-center gap-2 mb-4">
          <div className="loading-dot bg-orange-400" />
          <div className="loading-dot bg-rose-400" />
          <div className="loading-dot bg-violet-400" />
        </div>
        <p className="text-gray-500 text-lg">{t('loadingData')}</p>
      </div>
    </div>
  );
}

// ============ Error Component ============
function ErrorScreen({ message, onRetry, onOpenSettings }: { message: string; onRetry: () => void; onOpenSettings: () => void }) {
  const { t } = useI18n();
  const isRateLimit = message === 'RATE_LIMIT';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-warm-pattern px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">😅</div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">{t('loadError')}</h2>
        <p className="text-gray-500 mb-6">
          {isRateLimit ? t('rateLimitError') : message}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-gradient-to-r from-orange-400 to-rose-500 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            {t('retry')} 🔄
          </button>
          <button
            onClick={onOpenSettings}
            className="px-6 py-3 bg-white border-2 border-orange-300 text-orange-600 rounded-full font-medium shadow-sm hover:shadow-lg hover:border-orange-400 transition-all hover:scale-105 active:scale-95"
          >
            ⚙️ {t('configToken')}
          </button>
        </div>
        {isRateLimit && (
          <p className="text-xs text-gray-400 mt-4">{t('rateLimitHint')}</p>
        )}
      </div>
    </div>
  );
}

// ============ Empty State ============
function EmptyScreen() {
  const { t } = useI18n();
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">🌱</div>
      <h2 className="text-xl font-bold text-gray-600 mb-2">{t('noData')}</h2>
      <p className="text-gray-400">{t('noDataHint')}</p>
    </div>
  );
}

// ============ Stat Card ============
function StatCard({
  icon,
  value,
  label,
  gradient,
  delay = 0,
}: {
  icon: string;
  value: string | number;
  label: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <div
      className="card-hover bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-sm`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-800">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ============ Week Status Badge ============
function WeekStatusBadge({ deadline }: { deadline: string }) {
  const { t } = useI18n();
  const status = getWeekStatus(deadline);
  const config = {
    expired: { text: t('expired'), class: 'bg-gray-100 text-gray-500' },
    active: { text: t('active'), class: 'bg-green-100 text-green-600 pulse-glow' },
    upcoming: { text: t('upcoming'), class: 'bg-blue-100 text-blue-500' },
  };
  const c = config[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.class}`}>
      {c.text}
    </span>
  );
}

// ============ Overview Calendar ============
function OverviewCalendar({ students }: { students: Student[] }) {
  const { t, lang } = useI18n();
  const total = students.length;

  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let d = 1; d <= TOTAL_DAYS; d++) counts[d] = 0;
    for (const s of students) {
      for (const d of s.completedDays) {
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    return counts;
  }, [students]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <h2 className="text-xl font-bold text-gray-800 mb-1">{t('challengeCalendar')}</h2>
      <p className="text-sm text-gray-400 mb-5">{t('totalDaysLabel')} · {t('studentCount', { n: total })}</p>

      <div className="space-y-4">
        {WEEKS.map((week, wi) => {
          const wc = WEEK_COLORS[wi];
          const days = Array.from(
            { length: week.endDay - week.startDay + 1 },
            (_, i) => week.startDay + i
          );

          return (
            <div key={week.id} className={`rounded-xl ${wc.bg} border ${wc.border} p-4`}>
              <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${wc.accent}`}>
                    {t('weekLabel', { n: week.weekNum })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t('weekDaysRange', { start: week.startDay, end: week.endDay })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {t('deadline')}: {formatDeadline(week.deadline, lang)}
                  </span>
                  <WeekStatusBadge deadline={week.deadline} />
                </div>
              </div>

              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 7)}, minmax(0, 1fr))` }}>
                {days.map((day) => {
                  const count = dayCounts[day] || 0;
                  const ratio = total > 0 ? count / total : 0;
                  const heatClass = getHeatColor(ratio);
                  return (
                    <div
                      key={day}
                      className={`day-cell rounded-lg p-2 text-center cursor-default ${heatClass}`}
                    >
                      <div className="text-xs font-medium opacity-70">D{day}</div>
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-[10px] opacity-60">{t('submitted')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400">
        <span>{t('legend')}:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-100" />
          <span>{t('noSubmission')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-emerald-100" />
          <span>{t('lowCompletion')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-emerald-400" />
          <span>{t('highCompletion')}</span>
        </div>
      </div>
    </div>
  );
}

// ============ Student Calendar ============
function StudentCalendar({ student }: { student: Student }) {
  const { t, lang } = useI18n();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <h2 className="text-xl font-bold text-gray-800 mb-1">{t('personalCalendar')}</h2>
      <p className="text-sm text-gray-400 mb-5">
        {t('daysCompleted', { n: student.completedDays.length })} / {TOTAL_DAYS}
      </p>

      <div className="space-y-4">
        {WEEKS.map((week, wi) => {
          const wc = WEEK_COLORS[wi];
          const days = Array.from(
            { length: week.endDay - week.startDay + 1 },
            (_, i) => week.startDay + i
          );
          const weekSuccess = isWeeklySuccess(student, week.weekNum);
          const isLate = student.lateWeeks.includes(week.weekNum);
          const completedCount = getStudentWeekCompletedDays(student, week.weekNum);
          const totalDays = getWeekTotalDays(week.weekNum);

          return (
            <div key={week.id} className={`rounded-xl ${wc.bg} border ${wc.border} p-4`}>
              <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${wc.accent}`}>
                    {t('weekLabel', { n: week.weekNum })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t('completedSlash', { done: completedCount, total: totalDays })}
                  </span>
                  {isLate && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-600">
                      ⏰ {t('late')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {t('deadline')}: {formatDeadline(week.deadline, lang)}
                  </span>
                  {weekSuccess ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-600">
                      {t('success')}
                    </span>
                  ) : completedCount === totalDays && isLate ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-600">
                      {t('late')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      {t('failed')}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 7)}, minmax(0, 1fr))` }}>
                {days.map((day) => {
                  const completed = student.completedDays.includes(day);
                  return (
                    <div
                      key={day}
                      className={`day-cell rounded-lg p-2 text-center ${
                        completed
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-white/60 text-gray-300 border border-gray-200'
                      }`}
                    >
                      <div className="text-xs font-medium opacity-70">D{day}</div>
                      <div className="text-xl">{completed ? '✅' : '❌'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Daily Submissions Chart ============
function DailyChart({ students }: { students: Student[] }) {
  const { t } = useI18n();

  const chartData = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const day = i + 1;
      const count = students.reduce(
        (sum, s) => sum + (s.completedDays.includes(day) ? 1 : 0),
        0
      );
      const week = WEEKS.findIndex((w) => day >= w.startDay && day <= w.endDay);
      return { name: `D${day}`, count, week };
    });
  }, [students]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
          <p className="font-bold text-gray-700">{d.name}</p>
          <p className="text-orange-500">{d.count} {t('submitted')}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
      <h2 className="text-xl font-bold text-gray-800 mb-5">{t('dailySubmissions')}</h2>
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(251,146,60,0.08)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {chartData.map((entry, index) => (
                <rect key={index} fill={WEEK_COLORS[entry.week]?.bar || '#fb923c'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Week color legend for chart */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
        {WEEKS.map((w, i) => (
          <div key={w.id} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: WEEK_COLORS[i].bar }} />
            <span>{t('weekLabel', { n: w.weekNum })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Copy Button ============
function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? 'bg-emerald-100 text-emerald-600'
          : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600'
      }`}
    >
      {copied ? t('copySuccess') : label}
    </button>
  );
}

// ============ Weekly Success Lists ============
function WeeklySuccessSection({ students }: { students: Student[] }) {
  const { t, lang } = useI18n();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
      <h2 className="text-xl font-bold text-gray-800 mb-5">{t('weeklySuccessList')}</h2>

      <div className="space-y-3">
        {WEEKS.map((week, wi) => {
          const successStudents = getWeeklySuccessStudents(students, week.weekNum);
          const isExpanded = expandedWeek === week.weekNum;
          const wc = WEEK_COLORS[wi];

          const exportText = successStudents.length > 0
            ? `${t('weekLabel', { n: week.weekNum })} ${t('weeklySuccessList')}\n${'─'.repeat(40)}\n${
                successStudents
                  .map((s) => `${s.nickname}\t${s.githubUsername || '-'}\thttps://github.com/${s.githubUsername}`)
                  .join('\n')
              }`
            : '';

          return (
            <div key={week.id} className={`rounded-xl border ${wc.border} overflow-hidden`}>
              {/* Week header */}
              <button
                onClick={() => setExpandedWeek(isExpanded ? null : week.weekNum)}
                className={`w-full flex items-center justify-between p-4 ${wc.bg} hover:brightness-95 transition-all`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${wc.accent}`}>
                    {t('weekLabel', { n: week.weekNum })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t('weekDaysRange', { start: week.startDay, end: week.endDay })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    successStudents.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    🏆 {successStudents.length} {lang === 'zh' ? '人' : ''}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="p-4 bg-white border-t border-gray-100">
                  {successStudents.length > 0 ? (
                    <>
                      <div className="flex justify-end mb-3">
                        <CopyButton text={exportText} label={t('exportList')} />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-2 px-3 text-gray-400 font-medium">#</th>
                              <th className="text-left py-2 px-3 text-gray-400 font-medium">{t('nickname')}</th>
                              <th className="text-left py-2 px-3 text-gray-400 font-medium">{t('githubAccount')}</th>
                              <th className="text-left py-2 px-3 text-gray-400 font-medium">{t('completedDays')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {successStudents.map((s, i) => (
                              <tr key={s.nickname} className="border-b border-gray-50 hover:bg-orange-50/50 transition-colors">
                                <td className="py-2.5 px-3 text-gray-400">{i + 1}</td>
                                <td className="py-2.5 px-3 font-medium text-gray-700">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-300 to-rose-400 flex items-center justify-center text-white text-xs font-bold">
                                      {s.nickname.charAt(0).toUpperCase()}
                                    </span>
                                    {s.nickname}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {s.githubUsername ? (
                                    <a
                                      href={`https://github.com/${s.githubUsername}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 hover:underline"
                                    >
                                      @{s.githubUsername}
                                    </a>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="text-emerald-600 font-medium">
                                    {getStudentWeekCompletedDays(s, week.weekNum)}/{getWeekTotalDays(week.weekNum)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <span className="text-2xl">🌿</span>
                      <p className="mt-1">{t('noSuccessStudents')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Student Leaderboard ============
function StudentLeaderboard({ students, onSelect }: { students: Student[]; onSelect: (s: string) => void }) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return students.slice(0, 20);
    const q = search.toLowerCase();
    return students.filter(
      (s) => s.nickname.toLowerCase().includes(q) || s.githubUsername.toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">👥 {t('totalStudents')}</h2>
        <span className="text-sm text-gray-400">{students.length} {t('totalStudents').toLowerCase()}</span>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchStudent')}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent mb-4 bg-gray-50"
      />

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filtered.map((s, i) => {
          const pct = Math.round((s.completedDays.length / TOTAL_DAYS) * 100);

          return (
            <button
              key={s.nickname}
              onClick={() => onSelect(s.nickname)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 transition-all text-left group"
            >
              <span className="w-7 text-sm text-gray-400 font-medium">#{i + 1}</span>
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-rose-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {s.nickname.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 truncate">{s.nickname}</span>
                  {s.githubUsername && (
                    <span className="text-xs text-gray-400 truncate">@{s.githubUsername}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{pct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {[1, 2, 3, 4].map((wn) => (
                  <span
                    key={wn}
                    className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                      isWeeklySuccess(s, wn)
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gray-100 text-gray-300'
                    }`}
                  >
                    {wn}
                  </span>
                ))}
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            {t('noData')}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Student Detail View ============
function StudentDetail({
  student,
  onBack,
}: {
  student: Student;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const pct = Math.round((student.completedDays.length / TOTAL_DAYS) * 100);
  const weekSuccessCount = WEEKS.filter((w) => isWeeklySuccess(student, w.weekNum)).length;
  const allSuccess = weekSuccessCount === 4;

  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-orange-500 transition-colors mb-4 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">{t('back')}</span>
      </button>

      {/* Student header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-slide-up">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {student.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              {student.nickname}
              {allSuccess && <span className="text-lg">🏆</span>}
            </h2>
            {student.githubUsername && (
              <a
                href={`https://github.com/${student.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                @{student.githubUsername} ↗
              </a>
            )}
          </div>
          {allSuccess && (
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-md">
              {t('allWeeksSuccess')}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="📝" value={student.completedDays.length} label={t('completedDays')} gradient="from-orange-400 to-amber-500" delay={50} />
        <StatCard icon="📊" value={`${pct}%`} label={t('completionRate')} gradient="from-emerald-400 to-teal-500" delay={100} />
        <StatCard icon="🏆" value={`${weekSuccessCount}/4`} label={t('weeksPassed')} gradient="from-violet-400 to-purple-500" delay={150} />
        <StatCard icon="⏰" value={student.lateWeeks.length} label={t('lateWeeks')} gradient="from-rose-400 to-red-500" delay={200} />
      </div>

      {/* Calendar */}
      <StudentCalendar student={student} />

      {/* Week summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {WEEKS.map((week, wi) => {
          const success = isWeeklySuccess(student, week.weekNum);
          const isLate = student.lateWeeks.includes(week.weekNum);
          const completed = getStudentWeekCompletedDays(student, week.weekNum);
          const total = getWeekTotalDays(week.weekNum);
          const wc = WEEK_COLORS[wi];

          return (
            <div
              key={week.id}
              className={`rounded-xl p-4 text-center border ${
                success ? 'border-emerald-200 bg-emerald-50' : isLate ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
              } animate-slide-up`}
              style={{ animationDelay: `${300 + wi * 50}ms` }}
            >
              <div className={`text-sm font-bold mb-1 ${wc.accent}`}>
                {t('weekLabel', { n: week.weekNum })}
              </div>
              <div className="text-3xl mb-1">
                {success ? '✨' : isLate ? '⏰' : completed === total ? '✅' : '📝'}
              </div>
              <div className="text-sm font-bold text-gray-700">{completed}/{total}</div>
              <div className={`text-xs mt-1 font-medium ${
                success ? 'text-emerald-600' : isLate ? 'text-amber-600' : 'text-gray-400'
              }`}>
                {success ? t('success') : isLate ? t('late') : completed === total ? t('completed') : t('incomplete')}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============ Settings Panel ============
function SettingsPanel({
  token,
  onTokenChange,
  onApply,
  show,
  onToggle,
}: {
  token: string;
  onTokenChange: (t: string) => void;
  onApply: () => void;
  show: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onToggle}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">⚙️ {t('settingsTitle')}</h3>
        <p className="text-sm text-gray-400 mb-3">{t('tokenHint')}</p>
        <input
          type="password"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder={t('tokenPlaceholder')}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 mb-4 bg-gray-50"
        />
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            ✕
          </button>
          <button
            onClick={() => {
              onApply();
              onToggle();
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-400 to-rose-500 text-white text-sm font-medium hover:shadow-lg transition-all"
          >
            {t('apply')} ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Floating Emojis (Decoration) ============
function FloatingEmojis() {
  const emojis = ['📚', '✨', '🌟', '💡', '🎯', '🔥', '💪', '🌱'];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {emojis.map((emoji, i) => (
        <div
          key={i}
          className="absolute animate-float opacity-[0.07] text-4xl select-none"
          style={{
            left: `${10 + (i * 12) % 80}%`,
            top: `${5 + (i * 17) % 85}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }}
        >
          {emoji}
        </div>
      ))}
    </div>
  );
}

// ============ Main Dashboard ============
function Dashboard() {
  const { t, toggleLang } = useI18n();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const loadData = useCallback(async (tkn?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData(tkn || token || undefined);
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, []);

  const currentStudent = useMemo(() => {
    if (!selectedStudent) return null;
    return students.find((s) => s.nickname === selectedStudent) || null;
  }, [selectedStudent, students]);

  // Overview stats
  const totalSubmissions = useMemo(
    () => students.reduce((sum, s) => sum + s.completedDays.length, 0),
    [students]
  );
  const avgCompletion = useMemo(
    () => (students.length > 0 ? Math.round((totalSubmissions / (students.length * TOTAL_DAYS)) * 100) : 0),
    [students, totalSubmissions]
  );
  const fullCompletionCount = useMemo(
    () => students.filter((s) => s.completedDays.length === TOTAL_DAYS).length,
    [students]
  );

  if (loading) return <LoadingScreen />;
  if (error) return (
    <>
      <ErrorScreen message={error} onRetry={() => loadData()} onOpenSettings={() => setShowSettings(true)} />
      <SettingsPanel
        token={token}
        onTokenChange={setToken}
        onApply={() => loadData(token)}
        show={showSettings}
        onToggle={() => setShowSettings(!showSettings)}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-warm-pattern relative">
      <FloatingEmojis />

      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                  {t('title')}
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block">{t('subtitle')} 🌱</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* GitHub repo link */}
              <a
                href={`https://github.com/${REPO_OWNER}/${REPO_NAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all"
                title={t('repoLink')}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>

              {/* Settings button */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="px-3 py-1.5 rounded-lg bg-white/80 border border-gray-200 text-sm font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all"
              >
                {t('switchLang')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        {students.length === 0 ? (
          <EmptyScreen />
        ) : selectedStudent && currentStudent ? (
          /* Individual student view */
          <StudentDetail
            student={currentStudent}
            onBack={() => setSelectedStudent(null)}
          />
        ) : (
          /* Overview view */
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon="👥" value={students.length} label={t('totalStudents')} gradient="from-orange-400 to-amber-500" delay={0} />
              <StatCard icon="📝" value={totalSubmissions} label={t('totalSubmissions')} gradient="from-rose-400 to-pink-500" delay={50} />
              <StatCard icon="📊" value={`${avgCompletion}%`} label={t('avgCompletion')} gradient="from-violet-400 to-purple-500" delay={100} />
              <StatCard icon="🏆" value={fullCompletionCount} label={t('fullCompletion')} gradient="from-emerald-400 to-teal-500" delay={150} />
            </div>

            {/* Calendar */}
            <div className="mb-6">
              <OverviewCalendar students={students} />
            </div>

            {/* Chart */}
            <div className="mb-6">
              <DailyChart students={students} />
            </div>

            {/* Two-column layout: Weekly Success + Student Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <WeeklySuccessSection students={students} />
              <StudentLeaderboard students={students} onSelect={setSelectedStudent} />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/50 bg-white/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
          <span>🌟 {t('poweredBy')}</span>
          <a
            href={`https://github.com/${REPO_OWNER}/${REPO_NAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-orange-500 transition-colors"
          >
            {t('repoLink')} →
          </a>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsPanel
        token={token}
        onTokenChange={setToken}
        onApply={() => loadData(token)}
        show={showSettings}
        onToggle={() => setShowSettings(!showSettings)}
      />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Dashboard />
    </I18nProvider>
  );
}
