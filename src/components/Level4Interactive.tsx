import React, { useState } from 'react';
import type { UserProfile, UnitSubmission } from '../types';
import { ApiService } from '../services/api';
import { UnifiedUnitInteractive } from './UnifiedUnitInteractive';
import { UNIT_4_1_BLUEPRINT, UNIT_4_2_BLUEPRINT } from '../data/unit4_1_to_4_2Data';
import { CurriculumModal } from './CurriculumModal';
import { CheckCircle2, BookOpen, ArrowRight, Lock } from 'lucide-react';

interface Props {
  onPassLevel: () => void;
  onBackToDashboard?: () => void;
}

export const Level4Interactive: React.FC<Props> = ({ onPassLevel, onBackToDashboard }) => {
  const [profile] = useState<UserProfile | null>(() => ApiService.getLocalProfile());
  const [activeUnitId, setActiveUnitId] = useState<'4.1' | '4.2'>('4.1');
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);

  const [submissions, setSubmissions] = useState<Record<string, UnitSubmission>>(() => {
    const prog = ApiService.getLocalProgress();
    return prog.unitSubmissions || {};
  });

  const isCompleted4_1 = !!submissions['4.1'];
  const isCompleted4_2 = !!submissions['4.2'];
  const allCompleted = isCompleted4_1 && isCompleted4_2;

  const handleUnitSubmit = (sub: UnitSubmission) => {
    const updatedProg = ApiService.saveUnitSubmission(sub);
    setSubmissions(updatedProg.unitSubmissions || {});

    const visionText =
      sub.formData?.['วิสัยทัศน์ดิจิทัล_1ถึง2ประโยค_เน้นผู้เรียนและบริบท'] ||
      sub.formData?.['วิสัยทัศน์ดิจิทัล'];
    if (sub.unitId === '4.1' && visionText) {
      ApiService.saveLocalProgress({ visionStatement: String(visionText) });
    }

    const completedUnits = updatedProg.completedUnits || [];
    if (completedUnits.includes('4.1') && completedUnits.includes('4.2')) {
      ApiService.completeStep('level-4', 'evaluation');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                MODULE 4
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                การสร้างค่านิยมเชิงดิจิทัล (Digital Vision & Attitude)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              สร้างวิสัยทัศน์ดิจิทัลที่บอกผลต่อผู้เรียนแบบมีส่วนร่วม และวางแผนสร้างเจตคติเชิงบวก 3 เดือนตามหลัก TAM พร้อมสรุปผลรวมทั้งหลักสูตร 10 หน่วย
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
          <button
            type="button"
            onClick={() => setActiveUnitId('4.1')}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${activeUnitId === '4.1'
              ? 'bg-[#f5f3ff] border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900 shadow-xs'
              : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-600'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-indigo-700">หน่วย 4.1 (79 น.)</span>
              {isCompleted4_1 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านแล้ว ({submissions['4.1']?.totalScore}/10)
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400">พร้อมทำ</span>
              )}
            </div>
            <div className="text-sm font-extrabold text-slate-900">การสร้างวิสัยทัศน์เชิงดิจิทัล</div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isCompleted4_1) {
                alert('🔒 กรุณาทำกิจกรรมและส่งงานหน่วย 4.1 ให้เรียบร้อยก่อนเข้าสู่หน่วย 4.2 ครับ');
                return;
              }
              setActiveUnitId('4.2');
            }}
            className={`p-4 rounded-2xl border text-left transition ${
              !isCompleted4_1
                ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed text-slate-400'
                : activeUnitId === '4.2'
                ? 'bg-[#f5f3ff] border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900 shadow-xs cursor-pointer'
                : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-600 cursor-pointer'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-indigo-700">หน่วย 4.2 (78 น.)</span>
              {isCompleted4_2 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านแล้ว ({submissions['4.2']?.totalScore}/10)
                </span>
              ) : !isCompleted4_1 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  <Lock className="w-3 h-3" /> ล็อกอยู่
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400">พร้อมทำ</span>
              )}
            </div>
            <div className="text-sm font-extrabold text-slate-900">เจตคติเชิงบวกต่อเทคโนโลยี</div>
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
              <div className="font-extrabold text-slate-900 text-lg">
                ขอแสดงความยินดี! ท่านเรียนจบครบทั้ง 4 โมดูล (10 หน่วยการเรียนรู้) แล้ว
              </div>
              <p className="text-xs text-teal-800 font-semibold mt-0.5">
                พร้อมเข้าสู่แบบประเมินความพึงพอใจและรับเกียรติบัตรผู้สำเร็จหลักสูตรได้ทันที
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onPassLevel}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition cursor-pointer shrink-0"
          >
            ไปทำแบบประเมินและรับเกียรติบัตร <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeUnitId === '4.1' && (
        <UnifiedUnitInteractive
          blueprint={UNIT_4_1_BLUEPRINT}
          profile={profile}
          existingSubmission={submissions['4.1']}
          allSubmissions={submissions}
          onSubmitUnit={handleUnitSubmit}
          onNextUnit={() => setActiveUnitId('4.2')}
          onBackToDashboard={onBackToDashboard}
        />
      )}

      {activeUnitId === '4.2' && (
        <UnifiedUnitInteractive
          blueprint={UNIT_4_2_BLUEPRINT}
          profile={profile}
          existingSubmission={submissions['4.2']}
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
