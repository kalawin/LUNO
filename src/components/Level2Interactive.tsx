import React, { useState } from 'react';
import type { UserProfile, UnitSubmission } from '../types';
import { ApiService } from '../services/api';
import { UnifiedUnitInteractive } from './UnifiedUnitInteractive';
import {
  UNIT_2_1_BLUEPRINT,
  UNIT_2_2_BLUEPRINT,
  UNIT_2_3_BLUEPRINT
} from '../data/unit2_1_to_2_3Data';
import { CurriculumModal } from './CurriculumModal';
import { CheckCircle2, BookOpen, ArrowRight, Lock } from 'lucide-react';

interface Props {
  onPassLevel: () => void;
  onBackToDashboard?: () => void;
}

export const Level2Interactive: React.FC<Props> = ({ onPassLevel, onBackToDashboard }) => {
  const [profile] = useState<UserProfile | null>(() => ApiService.getLocalProfile());
  const [activeUnitId, setActiveUnitId] = useState<'2.1' | '2.2' | '2.3'>('2.1');
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);

  const [submissions, setSubmissions] = useState<Record<string, UnitSubmission>>(() => {
    const prog = ApiService.getLocalProgress();
    return prog.unitSubmissions || {};
  });

  const isCompleted2_1 = !!submissions['2.1'];
  const isCompleted2_2 = !!submissions['2.2'];
  const isCompleted2_3 = !!submissions['2.3'];
  const allCompleted = isCompleted2_1 && isCompleted2_2 && isCompleted2_3;

  const handleUnitSubmit = (sub: UnitSubmission) => {
    const updatedProg = ApiService.saveUnitSubmission(sub);
    setSubmissions(updatedProg.unitSubmissions || {});

    const completedUnits = updatedProg.completedUnits || [];
    if (completedUnits.includes('2.1') && completedUnits.includes('2.2') && completedUnits.includes('2.3')) {
      ApiService.completeStep('level-2', 'level-3');
    }
  };

  const handleNextUnitFrom = (current: '2.1' | '2.2' | '2.3') => {
    if (current === '2.1') setActiveUnitId('2.2');
    else if (current === '2.2') setActiveUnitId('2.3');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                MODULE 2
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                การสร้างวิถีการเรียนรู้เชิงดิจิทัล (Digital Learning Culture)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              โค้ชครูด้วยเทคโนโลยี ประเมินและจัดลำดับสภาพแวดล้อมดิจิทัล 3 ด้าน และใช้ข้อมูลจากแบบฟอร์มตัดสินใจ (พร้อมแบบวัดก่อน–หลังเรียนประจำหน่วย)
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCurriculumModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer self-start sm:self-auto"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" /> โครงสร้างหลักสูตร
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <button
            type="button"
            onClick={() => setActiveUnitId('2.1')}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${activeUnitId === '2.1'
              ? 'bg-[#eef2ff] border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900 shadow-xs'
              : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-600'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-800">หน่วย 2.1 (96 น.)</span>
              {isCompleted2_1 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านแล้ว ({submissions['2.1']?.totalScore}/10)
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">พร้อมทำ</span>
              )}
            </div>
            <div className="text-sm font-extrabold text-slate-900">การจัดการเรียนการสอนด้วยเทคโนโลยี</div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isCompleted2_1) {
                alert('🔒 กรุณาทำกิจกรรมและส่งงานหน่วย 2.1 ให้เรียบร้อยก่อนเข้าสู่หน่วย 2.2 ครับ');
                return;
              }
              setActiveUnitId('2.2');
            }}
            className={`p-4 rounded-2xl border text-left transition ${!isCompleted2_1
              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed text-slate-400'
              : activeUnitId === '2.2'
                ? 'bg-[#eef2ff] border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900 shadow-xs cursor-pointer'
                : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-600 cursor-pointer'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-800">หน่วย 2.2 (86 น.)</span>
              {isCompleted2_2 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านแล้ว ({submissions['2.2']?.totalScore}/10)
                </span>
              ) : !isCompleted2_1 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  <Lock className="w-3 h-3" /> ล็อกอยู่
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">พร้อมทำ</span>
              )}
            </div>
            <div className="text-sm font-extrabold text-slate-900">การจัดสภาพแวดล้อมที่เอื้อต่อการเรียนรู้</div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isCompleted2_2) {
                alert('🔒 กรุณาทำกิจกรรมและส่งงานหน่วย 2.2 ให้เรียบร้อยก่อนเข้าสู่หน่วย 2.3 ครับ');
                return;
              }
              setActiveUnitId('2.3');
            }}
            className={`p-4 rounded-2xl border text-left transition ${!isCompleted2_2
              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed text-slate-400'
              : activeUnitId === '2.3'
                ? 'bg-[#eef2ff] border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900 shadow-xs cursor-pointer'
                : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-600 cursor-pointer'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-800">หน่วย 2.3 (91 น.)</span>
              {isCompleted2_3 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านแล้ว ({submissions['2.3']?.totalScore}/10)
                </span>
              ) : !isCompleted2_2 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  <Lock className="w-3 h-3" /> ล็อกอยู่
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">พร้อมทำ</span>
              )}
            </div>
            <div className="text-sm font-extrabold text-slate-900">การวัดและประเมินผลด้วยเทคโนโลยี</div>
          </button>
        </div>
      </div>

      {allCompleted && (
        <div className="bg-[#eef8f5] border border-[#d2f0e6] rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center text-teal-600 shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-lg">ยอดเยี่ยม! ท่านผ่าน Module 2 ครบทั้ง 3 หน่วยแล้ว</div>
              <p className="text-xs text-teal-800 font-semibold mt-0.5">
                คะแนนรวม: {(submissions['2.1']?.totalScore || 0) + (submissions['2.2']?.totalScore || 0) + (submissions['2.3']?.totalScore || 0)} / 30 คะแนน · ปลดล็อก Module 3 แล้ว
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onPassLevel}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition cursor-pointer shrink-0"
          >
            เข้าสู่ Module 3 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeUnitId === '2.1' && (
        <UnifiedUnitInteractive
          blueprint={UNIT_2_1_BLUEPRINT}
          profile={profile}
          existingSubmission={submissions['2.1']}
          allSubmissions={submissions}
          onSubmitUnit={handleUnitSubmit}
          onNextUnit={() => handleNextUnitFrom('2.1')}
          onBackToDashboard={onBackToDashboard}
        />
      )}

      {activeUnitId === '2.2' && (
        <UnifiedUnitInteractive
          blueprint={UNIT_2_2_BLUEPRINT}
          profile={profile}
          existingSubmission={submissions['2.2']}
          allSubmissions={submissions}
          onSubmitUnit={handleUnitSubmit}
          onNextUnit={() => handleNextUnitFrom('2.2')}
          onBackToDashboard={onBackToDashboard}
        />
      )}

      {activeUnitId === '2.3' && (
        <UnifiedUnitInteractive
          blueprint={UNIT_2_3_BLUEPRINT}
          profile={profile}
          existingSubmission={submissions['2.3']}
          allSubmissions={submissions}
          onSubmitUnit={handleUnitSubmit}
          onNextUnit={onPassLevel}
          onBackToDashboard={onBackToDashboard}
        />
      )}

      <CurriculumModal isOpen={showCurriculumModal} onClose={() => setShowCurriculumModal(false)} />
    </div>
  );
};
