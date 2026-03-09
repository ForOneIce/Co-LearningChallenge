export const REPO_OWNER = '0xherstory';
export const REPO_NAME = 'WWW6.5';
const API_BASE = 'https://api.github.com';

export interface WeekConfig {
  id: string;
  weekNum: number;
  startDay: number;
  endDay: number;
  deadline: string;
}

export const WEEKS: WeekConfig[] = [
  { id: 'week1', weekNum: 1, startDay: 1, endDay: 7, deadline: '2026-03-09T00:00:00+08:00' },
  { id: 'week2', weekNum: 2, startDay: 8, endDay: 14, deadline: '2026-03-16T00:00:00+08:00' },
  { id: 'week3', weekNum: 3, startDay: 15, endDay: 21, deadline: '2026-03-23T00:00:00+08:00' },
  { id: 'week4', weekNum: 4, startDay: 22, endDay: 30, deadline: '2026-03-30T00:00:00+08:00' },
];

export const TOTAL_DAYS = 30;

export interface Student {
  nickname: string;
  githubUsername: string;
  completedDays: number[];
  lateWeeks: number[];
  prCount: number;
}

export interface PRInfo {
  number: number;
  title: string;
  user: string;
  state: string;
  merged: boolean;
  labels: string[];
  createdAt: string;
  mergedAt: string | null;
}

interface TreeItem {
  path: string;
  type: string;
}

function makeHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) h['Authorization'] = `token ${token}`;
  return h;
}

async function fetchRepoTree(token?: string): Promise<TreeItem[]> {
  const headers = makeHeaders(token);
  for (const branch of ['main', 'master']) {
    try {
      const res = await fetch(
        `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${branch}?recursive=1`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        return data.tree || [];
      }
      if (res.status === 403) {
        throw new Error('RATE_LIMIT');
      }
    } catch (e: any) {
      if (e.message === 'RATE_LIMIT') throw e;
    }
  }
  throw new Error('Failed to fetch repo tree');
}

async function fetchAllPRs(token?: string): Promise<PRInfo[]> {
  const headers = makeHeaders(token);
  const allPRs: PRInfo[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=all&per_page=100&page=${page}`,
      { headers }
    );
    if (!res.ok) {
      if (res.status === 403) throw new Error('RATE_LIMIT');
      break;
    }
    const prs = await res.json();
    if (!Array.isArray(prs) || prs.length === 0) break;

    for (const pr of prs) {
      allPRs.push({
        number: pr.number,
        title: pr.title || '',
        user: pr.user?.login || 'unknown',
        state: pr.state,
        merged: !!pr.merged_at,
        labels: (pr.labels || []).map((l: any) => l.name),
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
      });
    }

    page++;
    if (prs.length < 100) break;
  }

  return allPRs;
}

async function fetchPRFiles(prNumber: number, token?: string): Promise<string[]> {
  const headers = makeHeaders(token);
  try {
    const res = await fetch(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/files?per_page=100`,
      { headers }
    );
    if (!res.ok) return [];
    const files = await res.json();
    return Array.isArray(files) ? files.map((f: any) => f.filename) : [];
  } catch {
    return [];
  }
}

function parseStudentsFromTree(tree: TreeItem[]): Map<string, number[]> {
  const students = new Map<string, number[]>();
  const excludeDirs = new Set([
    '.github', 'node_modules', '.git', 'docs', 'scripts',
    'contracts', 'test', 'lib', 'src', 'out', 'cache',
    'broadcast', 'artifacts', 'deployments',
  ]);

  for (const item of tree) {
    if (item.type !== 'blob') continue;
    const parts = item.path.split('/');
    if (parts.length < 2) continue;

    const folder = parts[0];
    if (excludeDirs.has(folder) || excludeDirs.has(folder.toLowerCase())) continue;
    if (folder.startsWith('.')) continue;
    // Skip common non-student files
    if (['README.md', 'LICENSE', 'package.json', 'foundry.toml', 'remappings.txt'].includes(folder)) continue;

    const fileName = parts[parts.length - 1];
    if (!fileName.toLowerCase().endsWith('.sol')) continue;

    // Match day patterns across the full subpath
    const subpath = parts.slice(1).join('/');
    const dayMatch = subpath.match(/day[_\-\s]?0*(\d+)/i);
    if (!dayMatch) continue;

    const dayNum = parseInt(dayMatch[1], 10);
    if (dayNum < 1 || dayNum > 30) continue;

    if (!students.has(folder)) {
      students.set(folder, []);
    }
    const days = students.get(folder)!;
    if (!days.includes(dayNum)) {
      days.push(dayNum);
    }
  }

  return students;
}

export async function fetchDashboardData(token?: string): Promise<Student[]> {
  const [tree, prs] = await Promise.all([
    fetchRepoTree(token),
    fetchAllPRs(token),
  ]);

  const studentDaysMap = parseStudentsFromTree(tree);

  // Map GitHub usernames to folders
  const usernameToFolder = new Map<string, string>();
  const folderToUsername = new Map<string, string>();

  const mergedPRs = prs.filter((pr) => pr.merged);

  // Group merged PRs by author
  const authorPRs = new Map<string, PRInfo[]>();
  for (const pr of mergedPRs) {
    if (pr.user === 'unknown') continue;
    if (!authorPRs.has(pr.user)) {
      authorPRs.set(pr.user, []);
    }
    authorPRs.get(pr.user)!.push(pr);
  }

  // For each unique author, fetch files of one merged PR to find their folder
  const batchSize = 10;
  const authors = Array.from(authorPRs.entries());

  for (let i = 0; i < authors.length; i += batchSize) {
    const batch = authors.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ([author, prList]) => {
        const files = await fetchPRFiles(prList[0].number, token);
        for (const file of files) {
          const parts = file.split('/');
          if (parts.length >= 2) {
            const folder = parts[0];
            if (!folder.startsWith('.') && studentDaysMap.has(folder)) {
              usernameToFolder.set(author, folder);
              folderToUsername.set(folder, author);
              break;
            }
          }
        }
      })
    );
  }

  // Build student list
  const students: Student[] = [];
  for (const [folder, days] of studentDaysMap) {
    const githubUsername = folderToUsername.get(folder) || '';

    // Find late weeks from PR labels
    const lateWeeks: number[] = [];
    if (githubUsername) {
      for (const pr of prs) {
        if (pr.user !== githubUsername) continue;
        for (const label of pr.labels) {
          const match = label.match(/week(\d+)[_\-\s]?late/i);
          if (match) {
            const weekNum = parseInt(match[1], 10);
            if (weekNum >= 1 && weekNum <= 4 && !lateWeeks.includes(weekNum)) {
              lateWeeks.push(weekNum);
            }
          }
        }
      }
    }

    const prCount = githubUsername
      ? prs.filter((pr) => pr.user === githubUsername).length
      : 0;

    students.push({
      nickname: folder,
      githubUsername,
      completedDays: days.sort((a, b) => a - b),
      lateWeeks: lateWeeks.sort((a, b) => a - b),
      prCount,
    });
  }

  students.sort((a, b) => b.completedDays.length - a.completedDays.length);
  return students;
}

// ========= Utility functions =========

export function isWeeklySuccess(student: Student, weekNum: number): boolean {
  const week = WEEKS.find((w) => w.weekNum === weekNum);
  if (!week) return false;

  for (let day = week.startDay; day <= week.endDay; day++) {
    if (!student.completedDays.includes(day)) return false;
  }

  if (student.lateWeeks.includes(weekNum)) return false;
  return true;
}

export function getWeeklySuccessStudents(students: Student[], weekNum: number): Student[] {
  return students.filter((s) => isWeeklySuccess(s, weekNum));
}

export function getWeekForDay(day: number): WeekConfig | undefined {
  return WEEKS.find((w) => day >= w.startDay && day <= w.endDay);
}

export function getWeekStatus(deadline: string): 'expired' | 'active' | 'upcoming' {
  const now = new Date();
  const dl = new Date(deadline);
  // Week is "active" if the deadline hasn't passed
  // "upcoming" if the deadline is more than 7 days away... let's simplify
  // Actually, let's just check if deadline has passed
  if (now > dl) return 'expired';
  // Check if the week's start is in the future by checking if deadline - 7days > now
  const weekStart = new Date(dl.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (now < weekStart) return 'upcoming';
  return 'active';
}

export function formatDeadline(deadline: string, lang: 'zh' | 'en'): string {
  const d = new Date(deadline);
  if (lang === 'zh') {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function getStudentWeekCompletedDays(student: Student, weekNum: number): number {
  const week = WEEKS.find((w) => w.weekNum === weekNum);
  if (!week) return 0;
  let count = 0;
  for (let day = week.startDay; day <= week.endDay; day++) {
    if (student.completedDays.includes(day)) count++;
  }
  return count;
}

export function getWeekTotalDays(weekNum: number): number {
  const week = WEEKS.find((w) => w.weekNum === weekNum);
  if (!week) return 0;
  return week.endDay - week.startDay + 1;
}
