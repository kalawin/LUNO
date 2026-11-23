import React, { useEffect, useRef } from 'react';
import type { UserProfile, UserProgress } from '../types';
import { PRE_TEST_QUESTIONS, POST_TEST_QUESTIONS } from '../data/courseData';
import { Award, Printer, TrendingUp, BarChart3, Radar, Home, CheckCircle2 } from 'lucide-react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, RadarController, RadialLinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { printElementById } from '../utils/printHelper';

// Register Chart.js components
Chart.register(BarController, BarElement, CategoryScale, LinearScale, RadarController, RadialLinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface CertificateViewProps {
  profile: UserProfile;
  progress: UserProgress;
  onBackToDashboard?: () => void;
}

export const CertificateView: React.FC<CertificateViewProps> = ({ profile, progress, onBackToDashboard }) => {
  const barChartRef = useRef<HTMLCanvasElement | null>(null);
  const radarChartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{ bar?: Chart; radar?: Chart }>({});

  const unitScores = (() => {
    const allIds = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '4.1', '4.2'];
    const email = profile.id || profile.name || 'guest';
    let sumPre = 0;
    let sumPost = 0;
    let countSjt = 0;
    for (const id of allIds) {
      try {
        const k2 = `luno_unit_${id}_state_v2_${email}`;
        const k1 = `luno_unit1_1_state_v2_${email}`;
        const raw = localStorage.getItem(id === '1.1' ? k1 : k2) || localStorage.getItem(k2);
        if (raw) {
          const parsed = JSON.parse(raw);
          const preVal = typeof parsed.preScoreTotal === 'number' ? parsed.preScoreTotal : parsed.pretestScore;
          const postVal = typeof parsed.postScoreTotal === 'number' ? parsed.postScoreTotal : parsed.posttestScore;
          if (typeof preVal === 'number' || typeof postVal === 'number') {
            sumPre += Number(preVal || 0);
            sumPost += Number(postVal || 0);
            countSjt++;
          }
        }
      } catch {
        // ignore
      }
    }
    return { sumPre, sumPost, countSjt };
  })();

  const maxPre = unitScores.countSjt > 0 ? 90 : PRE_TEST_QUESTIONS.length || 10;
  const maxPost = unitScores.countSjt > 0 ? 90 : POST_TEST_QUESTIONS.length || 10;
  const pre = unitScores.countSjt > 0 ? unitScores.sumPre : progress.preTestScore ?? 0;
  const post = unitScores.countSjt > 0 ? unitScores.sumPost : progress.postTestScore ?? maxPost;
  const diff = post - pre;
  const growthPct = Math.round((diff / maxPost) * 100);

  const certCode = progress.certCode || `LUNO-${Math.floor(100000 + Math.random() * 900000)}`;
  const certDate = progress.completionDate || (() => {
    const today = new Date();
    const thMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${today.getDate()} ${thMonths[today.getMonth()]} ${today.getFullYear() + 543}`;
  })();

  const handlePrint = () => {
    printElementById('certificate-printable', `LUNO_Certificate_${profile.name}`, 'landscape');
  };

  useEffect(() => {
    // 1. Render Bar Chart
    if (barChartRef.current) {
      if (chartInstances.current.bar) {
        chartInstances.current.bar.destroy();
      }

      chartInstances.current.bar = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: ['ก่อนเรียน (Pre-test)', 'หลังเรียน (Post-test)'],
          datasets: [{
            label: `คะแนนสอบ (เต็ม ${maxPost})`,
            data: [pre, post],
            backgroundColor: ['#cbd5e1', '#0d9488'],
            borderColor: ['#94a3b8', '#0f766e'],
            borderWidth: 1.5,
            borderRadius: 12,
            maxBarThickness: 56,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: maxPost,
              ticks: { stepSize: 2, color: '#64748b', font: { family: 'Prompt, sans-serif' } },
              grid: { color: '#f1f5f9' }
            },
            x: {
              ticks: { color: '#334155', font: { family: 'Prompt, sans-serif', weight: 'bold' } },
              grid: { display: false }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              cornerRadius: 10,
              titleFont: { family: 'Prompt, sans-serif' },
              bodyFont: { family: 'Prompt, sans-serif' }
            }
          }
        }
      });
    }

    // 2. Render Radar Chart
    if (radarChartRef.current) {
      if (chartInstances.current.radar) {
        chartInstances.current.radar.destroy();
      }

      chartInstances.current.radar = new Chart(radarChartRef.current, {
        type: 'radar',
        data: {
          labels: [
            'การสื่อสารเชิงดิจิทัล',
            'การสร้างวิถีการเรียนรู้',
            'การทำงานเป็นทีมมืออาชีพ',
            'การสร้างค่านิยมเชิงดิจิทัล'
          ],
          datasets: [{
            label: 'ระดับสมรรถนะที่บรรลุ (%)',
            data: [95, 92, 98, 96],
            fill: true,
            backgroundColor: 'rgba(13, 148, 136, 0.18)',
            borderColor: '#0d9488',
            borderWidth: 2.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#0f766e',
            pointBorderWidth: 2,
            pointRadius: 4.5,
            pointHoverBackgroundColor: '#0f766e',
            pointHoverBorderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: { color: '#e2e8f0' },
              grid: { color: '#e2e8f0' },
              pointLabels: { color: '#334155', font: { size: 12, family: 'Prompt, sans-serif', weight: 'bold' } },
              ticks: { backdropColor: 'transparent', color: '#64748b', stepSize: 20 },
              min: 0,
              max: 100
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              cornerRadius: 10,
              titleFont: { family: 'Prompt, sans-serif' },
              bodyFont: { family: 'Prompt, sans-serif' }
            }
          }
        }
      });
    }

    const currentCharts = chartInstances.current;
    return () => {
      if (currentCharts.bar) currentCharts.bar.destroy();
      if (currentCharts.radar) currentCharts.radar.destroy();
    };
  }, [pre, post, maxPost]);

  return (
    <div className="max-w-5xl mx-auto space-y-7 animate-fade-in pb-12">
      
      {/* Action Bar (hidden when printing) */}
      <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 rounded-[28px] bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">
                ยินดีด้วยครับ! ท่านผ่านโปรแกรมพัฒนา Luno ครบสมบูรณ์
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> สำเร็จ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ท่านสามารถพิมพ์หรือบันทึกเกียรติบัตรเป็น PDF เพื่อเก็บเป็นหลักฐานการพัฒนาสมรรถนะวิชาชีพ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>พิมพ์เกียรติบัตร A4 / บันทึก PDF</span>
          </button>
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="กลับหน้าแผนผัง"
            >
              <Home className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Score Summary Metrics (hidden when printing) */}
      <div className="print:hidden grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-[24px] bg-white border border-slate-200/80 text-center shadow-xs">
          <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">คะแนนก่อนเรียน (Pre-test)</span>
          <div className="text-4xl font-black text-slate-700 mt-2">{pre} <span className="text-sm font-medium text-slate-400">/ {maxPre}</span></div>
        </div>

        <div className="p-6 rounded-[24px] bg-teal-50/50 border border-teal-200 text-center shadow-xs">
          <span className="text-xs text-teal-800 uppercase font-bold tracking-wider">คะแนนหลังเรียน (Post-test)</span>
          <div className="text-4xl font-black text-teal-700 mt-2">{post} <span className="text-sm font-medium text-teal-500">/ {maxPost}</span></div>
        </div>

        <div className="p-6 rounded-[24px] bg-emerald-50/50 border border-emerald-200 text-center shadow-xs">
          <span className="text-xs text-emerald-800 uppercase font-bold tracking-wider flex items-center justify-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> อัตราพัฒนาการ (Growth)
          </span>
          <div className="text-4xl font-black text-emerald-700 mt-2">
            {diff >= 0 ? `+${growthPct}%` : `${growthPct}%`}
          </div>
        </div>
      </div>

      {/* Charts Grid (Chart.js) (hidden when printing) */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Bar Chart */}
        <div className="p-6 rounded-[28px] bg-white border border-slate-200/80 shadow-xs">
          <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            เปรียบเทียบคะแนน Pre-test vs Post-test (เต็ม {maxPost} คะแนน)
          </h4>
          <div className="relative h-64 w-full">
            <canvas ref={barChartRef} />
          </div>
        </div>

        {/* Radar Chart */}
        <div className="p-6 rounded-[28px] bg-white border border-slate-200/80 shadow-xs">
          <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mb-4 flex items-center gap-2">
            <Radar className="w-5 h-5 text-teal-600" />
            ประเมินสมรรถนะภาวะผู้นำ 4 มิติ
          </h4>
          <div className="relative h-64 w-full">
            <canvas ref={radarChartRef} />
          </div>
        </div>
      </div>

      {/* Certificate Printable Card (A4 Landscape: 297mm x 210mm) */}
      <div
        id="certificate-printable"
        className="relative overflow-hidden w-full max-w-[297mm] md:aspect-[297/210] mx-auto rounded-[20px] p-8 sm:p-12 bg-[#fcfdfa] border-[8px] border-[#0f172a] shadow-xl text-center text-slate-900 flex flex-col justify-between print:rounded-none print:shadow-none print:border-[6px] print:m-0"
      >
        {/* Inner Gold Border */}
        <div className="absolute inset-2.5 sm:inset-3.5 border-2 border-amber-600/60 rounded-xl pointer-events-none" />
        
        {/* Decorative Gold Corners */}
        <div className="absolute top-4 left-4 w-8 sm:w-12 h-8 sm:h-12 border-t-2 border-l-2 border-amber-600 pointer-events-none" />
        <div className="absolute top-4 right-4 w-8 sm:w-12 h-8 sm:h-12 border-t-2 border-r-2 border-amber-600 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-8 sm:w-12 h-8 sm:h-12 border-b-2 border-l-2 border-amber-600 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-8 sm:w-12 h-8 sm:h-12 border-b-2 border-r-2 border-amber-600 pointer-events-none" />

        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between relative z-10 py-1">
          {/* Top Institutional Logos Area (KKU / Faculty of Education KKU / OBEC Khon Kaen Area 1) */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-center gap-6 sm:gap-10 pt-1">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-xs border border-amber-200/80 flex items-center justify-center">
                  <img
                    src="/logos/kku-logo.png"
                    alt="ตราสัญลักษณ์มหาวิทยาลัยขอนแก่น"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-xs border border-amber-200/80 flex items-center justify-center">
                  <img
                    src="/logos/ed-kku-logo.jpg"
                    alt="ตราสัญลักษณ์คณะศึกษาศาสตร์ มหาวิทยาลัยขอนแก่น"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-xs border border-amber-200/80 flex items-center justify-center">
                  <img
                    src="/logos/obec-logo.jpg"
                    alt="ตราสัญลักษณ์สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน สพป.ขอนแก่น เขต 1"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="text-xs sm:text-sm tracking-wide text-slate-600 font-extrabold leading-snug">
              มหาวิทยาลัยขอนแก่น • คณะศึกษาศาสตร์ มหาวิทยาลัยขอนแก่น
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> • </span>
              สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพป.ขอนแก่น เขต 1)
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              เกียรติบัตรรับรองสมรรถนะผู้นำดิจิทัล
            </h2>
          </div>

          <div className="space-y-2.5 my-3">
            <p className="text-xs sm:text-sm text-slate-500">
              ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า
            </p>

            <div className="text-2xl sm:text-4xl font-black text-slate-900 border-b-2 border-amber-500/80 pb-2 inline-block min-w-[300px] px-8">
              {profile.name}
            </div>

            <p className="text-sm sm:text-base text-slate-700 font-medium">
              สถานศึกษา: <span className="text-slate-900 font-bold">{profile.school || 'สถานศึกษาขนาดเล็ก'}</span>
            </p>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed pt-1">
              ได้ผ่านการพัฒนาภาวะผู้นำดิจิทัลของผู้บริหารสถานศึกษาขนาดเล็ก ครบทั้ง 4 โมดูล 10 หน่วยการเรียนรู้
              (การสื่อสารเชิงดิจิทัล, การสร้างวิถีการเรียนรู้เชิงดิจิทัล, การพัฒนาสู่ความเป็นมืออาชีพ, การสร้างค่านิยมเชิงดิจิทัล)
              ตามเกณฑ์มาตรฐานโปรแกรม LUNO เป็นผลสำเร็จสมบูรณ์
            </p>
          </div>

          {/* Bottom signatures and certification info */}
          <div className="pt-4 flex justify-between items-end text-xs text-slate-500 border-t border-slate-200 mt-2 px-4">
            <div className="text-left space-y-1">
              <div className="font-bold text-teal-800">รหัสรับรอง: {certCode}</div>
              <div className="text-slate-500">ออกให้ ณ วันที่ {certDate}</div>
            </div>

            <div className="text-center">
              <div className="font-medium text-slate-800 text-xs sm:text-sm mb-1">
                (นายกาลวิน อดทน, นางสาวณัฎฐธิดา ใจอักษร, นางสาวบุษยา ศรีเพชร์)
              </div>
              <div className="border-t border-slate-300 pt-1 text-slate-500 text-[11px]">
                คณะผู้พัฒนาโปรแกรมและงานวิจัย LUNO
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
