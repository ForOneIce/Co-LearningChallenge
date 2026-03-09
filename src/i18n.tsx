import React, { createContext, useContext, useState, useCallback } from 'react';

export type Lang = 'zh' | 'en';

const translations = {
  zh: {
    title: '共学营挑战日历',
    subtitle: '一起学习，一起成长',
    overview: '总览',
    selectStudent: '选择学员查看详情',
    allStudents: '🌟 总体统计',
    totalStudents: '学员总数',
    totalSubmissions: '总提交数',
    avgCompletion: '平均完成率',
    fullCompletion: '全勤学员',
    completedDays: '已完成天数',
    completionRate: '完成率',
    weeksPassed: '通过周数',
    lateWeeks: '超时周数',
    challengeCalendar: '📅 挑战日历',
    personalCalendar: '📅 个人打卡日历',
    day: '天',
    week: '周',
    weekLabel: '第{n}周',
    deadline: '截止',
    expired: '已截止',
    active: '进行中',
    upcoming: '未开始',
    submitted: '人已提交',
    completed: '已完成',
    incomplete: '未完成',
    late: '超时',
    success: '✨ 闯关成功',
    failed: '闯关失败',
    pending: '进行中',
    weeklySuccessList: '🏆 每周闯关成功名单',
    nickname: '昵称',
    githubAccount: 'GitHub 账号',
    noSuccessStudents: '暂无闯关成功学员',
    weekDaysRange: 'Day {start} ~ Day {end}',
    completedSlash: '{done}/{total}',
    dailySubmissions: '📊 每日提交趋势',
    personCount: '人数',
    loading: '加载中',
    loadingData: '正在从 GitHub 获取数据，请稍候...',
    loadError: '加载失败',
    rateLimitError: 'GitHub API 请求次数超限，请稍后重试或输入 Token',
    retry: '重试',
    noData: '暂无数据',
    noDataHint: '还没有学员提交作业，等待同学们的第一份作业吧！📝',
    repoLink: '查看仓库',
    poweredBy: '共学营挑战追踪系统',
    tokenHint: '输入 GitHub Token 可提高 API 请求限额（60→5000次/小时）',
    tokenPlaceholder: 'ghp_xxxx（可选）',
    exportList: '📋 复制名单',
    copySuccess: '✅ 已复制到剪贴板！',
    githubProfile: '查看 GitHub',
    totalDaysLabel: '共 30 天',
    prCount: 'PR 数',
    rank: '排名',
    progress: '进度',
    switchLang: 'EN',
    legend: '图例',
    highCompletion: '完成率高',
    lowCompletion: '完成率低',
    noSubmission: '无提交',
    studentCount: '{n} 人',
    weekStatus: '周状态',
    daysCompleted: '{n} 天已完成',
    back: '返回总览',
    searchStudent: '搜索学员...',
    allWeeksSuccess: '🎉 全部通过！',
    settingsTitle: '设置',
    apply: '应用',
    configToken: '配置 Token',
    rateLimitHint: '配置 GitHub Token 可解除 API 请求限制',
  },
  en: {
    title: 'Co-Learning Challenge',
    subtitle: 'Learn together, grow together',
    overview: 'Overview',
    selectStudent: 'Select a student to view details',
    allStudents: '🌟 Overview',
    totalStudents: 'Total Students',
    totalSubmissions: 'Submissions',
    avgCompletion: 'Avg Completion',
    fullCompletion: 'Full Completion',
    completedDays: 'Days Done',
    completionRate: 'Completion',
    weeksPassed: 'Weeks Passed',
    lateWeeks: 'Late Weeks',
    challengeCalendar: '📅 Challenge Calendar',
    personalCalendar: '📅 Personal Calendar',
    day: 'Day',
    week: 'Week',
    weekLabel: 'Week {n}',
    deadline: 'Due',
    expired: 'Expired',
    active: 'Active',
    upcoming: 'Upcoming',
    submitted: 'submitted',
    completed: 'Done',
    incomplete: 'Missing',
    late: 'Late',
    success: '✨ Success',
    failed: 'Failed',
    pending: 'In Progress',
    weeklySuccessList: '🏆 Weekly Success List',
    nickname: 'Nickname',
    githubAccount: 'GitHub Account',
    noSuccessStudents: 'No successful students yet',
    weekDaysRange: 'Day {start} ~ Day {end}',
    completedSlash: '{done}/{total}',
    dailySubmissions: '📊 Daily Submissions',
    personCount: 'Count',
    loading: 'Loading',
    loadingData: 'Fetching data from GitHub, please wait...',
    loadError: 'Load Failed',
    rateLimitError: 'GitHub API rate limit exceeded. Try again later or enter a Token.',
    retry: 'Retry',
    noData: 'No Data',
    noDataHint: 'No submissions yet. Waiting for the first assignment! 📝',
    repoLink: 'View Repo',
    poweredBy: 'Co-Learning Challenge Tracker',
    tokenHint: 'Enter a GitHub Token for higher API limits (60→5000 req/hr)',
    tokenPlaceholder: 'ghp_xxxx (optional)',
    exportList: '📋 Copy List',
    copySuccess: '✅ Copied to clipboard!',
    githubProfile: 'View GitHub',
    totalDaysLabel: '30 Days Total',
    prCount: 'PRs',
    rank: 'Rank',
    progress: 'Progress',
    switchLang: '中文',
    legend: 'Legend',
    highCompletion: 'High',
    lowCompletion: 'Low',
    noSubmission: 'None',
    studentCount: '{n} students',
    weekStatus: 'Week Status',
    daysCompleted: '{n} days done',
    back: 'Back to Overview',
    searchStudent: 'Search student...',
    allWeeksSuccess: '🎉 All Passed!',
    settingsTitle: 'Settings',
    apply: 'Apply',
    configToken: 'Configure Token',
    rateLimitHint: 'Configure a GitHub Token to remove API rate limits',
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text: string = (translations[lang] as Record<string, string>)[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang]
  );

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
