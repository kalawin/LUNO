import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileText,
  Send,
  RotateCcw,
  Award,
  Eye,
  MessageSquare,
  CheckSquare,
  Square,
  ShieldAlert,
  Trophy
} from 'lucide-react';
import type { UnitBlueprintConfig, SJTQuestion } from '../data/unit1_2_to_1_3Data';
import type { UserProfile, UnitSubmission } from '../types';
import { UNITS_DATA } from '../data/modulesData';
import { EvaluatorEngine, type UnitEvaluationResult } from '../utils/evaluatorEngine';
import { ArtifactPdfModal } from './ArtifactPdfModal';

interface UnifiedUnitInteractiveProps {
  blueprint: UnitBlueprintConfig;
  profile: UserProfile | null;
  existingSubmission?: UnitSubmission;
  allSubmissions?: Record<string, UnitSubmission>;
  onSubmitUnit: (sub: UnitSubmission) => void;
  onNextUnit?: () => void;
  onBackToDashboard?: () => void;
}

type StageKey = 'pretest' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'posttest';

interface PersistedUnitState {
  assignedPreForm: 'A' | 'B';
  pretestSubmitted: boolean;
  pretestMcqAnswers: Record<number, string>;
  pretestWrittenAnswer: string;
  pretestScore: number;
  pretestObjScores: Record<number, number>;

  posttestSubmitted: boolean;
  posttestMcqAnswers: Record<number, string>;
  posttestWrittenAnswer: string;
  posttestScore: number;
  posttestObjScores: Record<number, number>;

  step1ChoiceId: string;
  step1SurveyAnswers: Record<string, string>;
  preConfidence: number;

  openedCards: string[];
  sortingAnswers: Record<string, string>;
  sortingRetryCount: number;

  tappedHotspots: string[];
  selectedFlaws: string[];

  formData: Record<string, string>;
  draftSaved: boolean;
  injectedReply: string;
  roleChatReplies: Record<number, string>;

  selfRatings: Record<string, number>;
  manualChecks: Record<number, boolean>;
  firstSubmitted: boolean;
  firstEvaluation?: UnitEvaluationResult;
  revisionSaved: boolean;
  reflection1: string;
  reflection2: string;
  postConfidence: number;
}

const PERSON_TITLE_REGEX = /(?:^|[\s,(])(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*[ก-ฮ]/;
const BROAD_VISION_WORDS_REGEX = /(เป็นเลิศ|ก้าวไกล|ชั้นนำ|สู่สากล|มาตรฐานสากล)/;
const WHY_NOT_QUESTION_REGEX = /(ทำไมไม่|ทำไมถึงไม่|ทำไมครูไม่)/;

function hashFormAssignment(email: string, unitId: string): 'A' | 'B' {
  const str = `${email || 'guest'}_${unitId}`;
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum = (sum * 31 + str.charCodeAt(i)) % 997;
  }
  return sum % 2 === 0 ? 'A' : 'B';
}

function scoreWrittenSJT(answer: string): number {
  const cleaned = (answer || '').trim();
  if (cleaned.length < 12) return 0;
  let pts = 1;
  if (cleaned.length >= 35) pts++;
  if (
    /[0-9๑-๙]+/.test(cleaned) ||
    /(ภายใน|เวลา|วัน|สัปดาห์|เดือน|ส่วนตัว|ผู้รับผิดชอบ|ครู|นักเรียน|ตรวจสอบ|หลักฐาน|เกณฑ์)/.test(cleaned)
  ) {
    pts++;
  }
  return Math.min(3, pts);
}

function evaluateSJTForm(
  questions: SJTQuestion[],
  mcqAnswers: Record<number, string>,
  writtenAnswer: string
): { total: number; objScores: Record<number, number>; objMax: Record<number, number> } {
  let total = 0;
  const objScores: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const objMax: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

  for (const q of questions) {
    objMax[q.objectiveIndex] = (objMax[q.objectiveIndex] || 0) + q.maxScore;
    if (q.type === 'mcq') {
      const chosen = mcqAnswers[q.number];
      const pt = chosen && chosen === q.correctLabel ? 1 : 0;
      total += pt;
      objScores[q.objectiveIndex] = (objScores[q.objectiveIndex] || 0) + pt;
    } else {
      const pt = scoreWrittenSJT(writtenAnswer);
      total += pt;
      objScores[q.objectiveIndex] = (objScores[q.objectiveIndex] || 0) + pt;
    }
  }
  return { total, objScores, objMax };
}

export const UnifiedUnitInteractive: React.FC<UnifiedUnitInteractiveProps> = ({
  blueprint,
  profile,
  existingSubmission,
  allSubmissions,
  onSubmitUnit,
  onNextUnit,
  onBackToDashboard
}) => {
  const { unitId } = blueprint;
  const unitDef = UNITS_DATA[unitId];
  const userEmail = profile?.id || profile?.name || 'guest';
  const savedArtifactData = existingSubmission?.formData;
  const storageKey = `luno_unit_${unitId}_state_v2_${userEmail}`;

  const loadInitialState = (): PersistedUnitState => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          assignedPreForm: parsed.assignedPreForm || hashFormAssignment(userEmail, unitId),
          pretestSubmitted: !!parsed.pretestSubmitted,
          pretestMcqAnswers: parsed.pretestMcqAnswers || {},
          pretestWrittenAnswer: parsed.pretestWrittenAnswer || '',
          pretestScore: typeof parsed.pretestScore === 'number' ? parsed.pretestScore : 0,
          pretestObjScores: parsed.pretestObjScores || { 1: 0, 2: 0, 3: 0 },

          posttestSubmitted: !!parsed.posttestSubmitted,
          posttestMcqAnswers: parsed.posttestMcqAnswers || {},
          posttestWrittenAnswer: parsed.posttestWrittenAnswer || '',
          posttestScore: typeof parsed.posttestScore === 'number' ? parsed.posttestScore : 0,
          posttestObjScores: parsed.posttestObjScores || { 1: 0, 2: 0, 3: 0 },

          step1ChoiceId: parsed.step1ChoiceId || '',
          step1SurveyAnswers: parsed.step1SurveyAnswers || {},
          preConfidence: parsed.preConfidence || 0,

          openedCards: parsed.openedCards || [],
          sortingAnswers: parsed.sortingAnswers || {},
          sortingRetryCount: parsed.sortingRetryCount || 0,

          tappedHotspots: parsed.tappedHotspots || [],
          selectedFlaws: parsed.selectedFlaws || [],

          formData: parsed.formData || (savedArtifactData as Record<string, string>) || {},
          draftSaved: !!parsed.draftSaved || !!savedArtifactData,
          injectedReply: parsed.injectedReply || (savedArtifactData?.['คำตอบเหตุการณ์แทรก'] as string) || '',
          roleChatReplies: parsed.roleChatReplies || {},

          selfRatings: parsed.selfRatings || {},
          manualChecks: parsed.manualChecks || {},
          firstSubmitted: !!parsed.firstSubmitted || !!existingSubmission,
          firstEvaluation: parsed.firstEvaluation,
          revisionSaved: !!parsed.revisionSaved,
          reflection1: parsed.reflection1 || '',
          reflection2: parsed.reflection2 || '',
          postConfidence: parsed.postConfidence || 0
        };
      }
    } catch {
      // ignore storage errors
    }

    const defaultFormData: Record<string, string> = {};
    for (const f of blueprint.step4.fields) {
      defaultFormData[f.key] = (savedArtifactData?.[f.key] as string) || (f.options ? f.options[0] : '');
    }

    return {
      assignedPreForm: hashFormAssignment(userEmail, unitId),
      pretestSubmitted: false,
      pretestMcqAnswers: {},
      pretestWrittenAnswer: '',
      pretestScore: 0,
      pretestObjScores: { 1: 0, 2: 0, 3: 0 },

      posttestSubmitted: false,
      posttestMcqAnswers: {},
      posttestWrittenAnswer: '',
      posttestScore: 0,
      posttestObjScores: { 1: 0, 2: 0, 3: 0 },

      step1ChoiceId: '',
      step1SurveyAnswers: {},
      preConfidence: 0,

      openedCards: [],
      sortingAnswers: {},
      sortingRetryCount: 0,

      tappedHotspots: [],
      selectedFlaws: [],

      formData: defaultFormData,
      draftSaved: !!savedArtifactData,
      injectedReply: (savedArtifactData?.['คำตอบเหตุการณ์แทรก'] as string) || '',
      roleChatReplies: {},

      selfRatings: {},
      manualChecks: {},
      firstSubmitted: !!existingSubmission,
      firstEvaluation: undefined,
      revisionSaved: false,
      reflection1: '',
      reflection2: '',
      postConfidence: 0
    };
  };

  const [state, setState] = useState<PersistedUnitState>(loadInitialState);
  const [activeStage, setActiveStage] = useState<StageKey>(() => {
    const init = loadInitialState();
    if (!init.pretestSubmitted) return 'pretest';
    if (init.firstSubmitted && !init.posttestSubmitted) return 'posttest';
    return 'step1';
  });
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Re-initialize when blueprint.unitId changes
  useEffect(() => {
    const nextState = loadInitialState();
    setState(nextState);
    if (!nextState.pretestSubmitted) setActiveStage('pretest');
    else if (nextState.firstSubmitted && !nextState.posttestSubmitted) setActiveStage('posttest');
    else setActiveStage('step1');
    setStatusBanner(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, userEmail]);

  // Persist to localStorage on every state update
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, storageKey]);

  const preFormQuestions = state.assignedPreForm === 'A' ? blueprint.sjtFormA : blueprint.sjtFormB;
  const postFormCode: 'A' | 'B' = state.assignedPreForm === 'A' ? 'B' : 'A';
  const postFormQuestions = postFormCode === 'A' ? blueprint.sjtFormA : blueprint.sjtFormB;

  // Cross-unit data lookups (for 4.1 referencing 2.2, and 4.2 referencing 4.1 + all 10 units)
  const crossUnit2_2Summary = useMemo(() => {
    if (unitId !== '4.1') return null;
    try {
      const raw = localStorage.getItem(`luno_unit_2.2_state_v2_${userEmail}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.formData?.['ระดับความพร้อม1ถึง5_ทั้ง3ด้านพร้อมอ้างตัวเลข'] || null;
    } catch {
      return null;
    }
  }, [unitId, userEmail]);

  const crossUnit4_1Vision = useMemo(() => {
    if (unitId !== '4.2') return null;
    try {
      const raw = localStorage.getItem(`luno_unit_4.1_state_v2_${userEmail}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.formData?.['วิสัยทัศน์ดิจิทัล_1ถึง2ประโยค_เน้นผู้เรียนและบริบท'] || null;
    } catch {
      return null;
    }
  }, [unitId, userEmail]);

  // Auto-checklist evaluations in Step 5
  const autoCheckResults = useMemo(() => {
    const allFieldsFilled = blueprint.step4.fields.every(
      f => (state.formData[f.key] || '').trim().length >= 4
    );
    const combinedValues = Object.values(state.formData).join(' ');
    const noPersonTitle = !PERSON_TITLE_REGEX.test(combinedValues);
    const noBroadVisionWords = !BROAD_VISION_WORDS_REGEX.test(combinedValues);
    const hasNumbers = /[0-9๑-๙]+/.test(combinedValues);
    const noUnknownSource = !/ไม่ทราบที่มา/.test(combinedValues);

    return blueprint.step5.autoChecklistItems.map(item => {
      let passed = allFieldsFilled;
      if (item.checkFnKey === 'noPersonTitle') passed = allFieldsFilled && noPersonTitle;
      else if (item.checkFnKey === 'noBroadVisionWords') passed = allFieldsFilled && noBroadVisionWords;
      else if (item.checkFnKey === 'hasNumbers') passed = allFieldsFilled && hasNumbers;
      else if (item.checkFnKey === 'noUnknownSource') passed = allFieldsFilled && noUnknownSource;
      return { label: item.label, passed };
    });
  }, [blueprint.step4.fields, blueprint.step5.autoChecklistItems, state.formData]);

  // Selected role sequence for Unit 1.2
  const activeRoleSequence = useMemo(() => {
    if (!blueprint.step4.roleChatSequences) return null;
    const chosenGroup = state.formData['กลุ่มที่เลือกพัฒนา'] || 'ผู้ปกครอง';
    return (
      blueprint.step4.roleChatSequences.find(r => r.roleId === chosenGroup) ||
      blueprint.step4.roleChatSequences[0]
    );
  }, [blueprint.step4.roleChatSequences, state.formData]);

  const handlePretestSubmit = () => {
    const mcqAnsweredCount = Object.keys(state.pretestMcqAnswers).length;
    if (mcqAnsweredCount < 6 || state.pretestWrittenAnswer.trim().length < 5) {
      setStatusBanner('กรุณาตอบข้อปรนัยให้ครบทั้ง 6 ข้อ และพิมพ์คำตอบข้อ 7 ก่อนกดส่งแบบวัดก่อนเรียน');
      return;
    }
    const res = evaluateSJTForm(preFormQuestions, state.pretestMcqAnswers, state.pretestWrittenAnswer);
    setState(prev => ({
      ...prev,
      pretestSubmitted: true,
      pretestScore: res.total,
      pretestObjScores: res.objScores
    }));
    setStatusBanner(null);
    setActiveStage('step1');
  };

  const handleSaveStep4Draft = () => {
    const combinedReply = activeRoleSequence
      ? [1, 2, 3]
          .map(idx => `ข้อความที่ ${idx}: ${state.roleChatReplies[idx] || ''}`)
          .join('\n')
          .trim()
      : state.injectedReply;

    setState(prev => ({
      ...prev,
      injectedReply: combinedReply,
      draftSaved: true
    }));
    setStatusBanner('บันทึกร่างเรียบร้อยแล้ว! ระบบเปิดสถานการณ์จำลอง/เหตุการณ์แทรกด้านล่างให้ท่านดำเนินการต่อ');
  };

  const handleFirstSubmitWork = () => {
    const combinedReply = activeRoleSequence
      ? [1, 2, 3]
          .map(idx => `ข้อความที่ ${idx}: ${state.roleChatReplies[idx] || ''}`)
          .join('\n')
          .trim()
      : state.injectedReply;

    const payload: Record<string, any> = {
      ...state.formData,
      คำตอบเหตุการณ์แทรก: combinedReply,
      สะท้อนคิด_1: state.reflection1,
      สะท้อนคิด_2: state.reflection2,
      ความมั่นใจก่อนเรียน: state.preConfidence,
      ความมั่นใจหลังเรียน: state.postConfidence,
      คะแนนแบบวัดก่อนเรียน: `${state.pretestScore}/9 (ฉบับ ${state.assignedPreForm === 'A' ? 'ก' : 'ข'})`
    };

    const evalResult = EvaluatorEngine.evaluate(unitId, payload);
    setState(prev => ({
      ...prev,
      injectedReply: combinedReply,
      firstSubmitted: true,
      firstEvaluation: evalResult
    }));
    onSubmitUnit({
      unitId,
      formData: payload,
      rubricScores: evalResult.scores,
      totalScore: evalResult.totalScore,
      reflectionNotes: [state.reflection1, state.reflection2].filter(Boolean).join('\n'),
      submittedAt: new Date().toISOString()
    });
    setStatusBanner('ส่งงานฉบับแรกเรียบร้อยแล้ว! ระบบเปิดแนวคำตอบและจุดที่ต้องจับด้านล่างให้ท่านเปรียบเทียบ');
  };

  const handleSaveRevisionForPdf = () => {
    setState(prev => ({ ...prev, revisionSaved: true }));
    setPdfModalOpen(true);
  };

  const handlePosttestSubmit = () => {
    const mcqAnsweredCount = Object.keys(state.posttestMcqAnswers).length;
    if (mcqAnsweredCount < 6 || state.posttestWrittenAnswer.trim().length < 5) {
      setStatusBanner('กรุณาตอบข้อปรนัยให้ครบทั้ง 6 ข้อ และพิมพ์คำตอบข้อ 7 ก่อนกดส่งแบบวัดหลังเรียน');
      return;
    }
    const res = evaluateSJTForm(postFormQuestions, state.posttestMcqAnswers, state.posttestWrittenAnswer);
    setState(prev => ({
      ...prev,
      posttestSubmitted: true,
      posttestScore: res.total,
      posttestObjScores: res.objScores
    }));
    setStatusBanner(null);

    const combinedReply = activeRoleSequence
      ? [1, 2, 3]
          .map(idx => `ข้อความที่ ${idx}: ${state.roleChatReplies[idx] || ''}`)
          .join('\n')
          .trim()
      : state.injectedReply;
    const payload: Record<string, any> = {
      ...state.formData,
      คำตอบเหตุการณ์แทรก: combinedReply,
      สะท้อนคิด_1: state.reflection1,
      สะท้อนคิด_2: state.reflection2,
      คะแนนแบบวัดก่อนเรียน: `${state.pretestScore}/9 (ฉบับ ${state.assignedPreForm === 'A' ? 'ก' : 'ข'})`,
      คะแนนแบบวัดหลังเรียน: `${res.total}/9 (ฉบับ ${postFormCode === 'A' ? 'ก' : 'ข'})`
    };
    const evalResult = state.firstEvaluation || EvaluatorEngine.evaluate(unitId, payload);

    onSubmitUnit({
      unitId,
      formData: payload,
      rubricScores: evalResult.scores,
      totalScore: evalResult.totalScore,
      reflectionNotes: [state.reflection1, state.reflection2].filter(Boolean).join('\n'),
      submittedAt: new Date().toISOString()
    });
  };

  // Course-wide 10-unit summary helper for Unit 4.2
  const courseWideSummaryRows = useMemo(() => {
    if (!blueprint.step5.isFinalCourseUnit) return [];
    const allUnitIds = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '4.1', '4.2'];
    return allUnitIds.map(id => {
      const def = UNITS_DATA[id];
      const evalScore =
        id === unitId
          ? state.firstEvaluation?.totalScore ?? existingSubmission?.totalScore
          : allSubmissions?.[id]?.totalScore;

      let preScore: number | null = null;
      let postScore: number | null = null;
      try {
        const keyV2 = `luno_unit_${id}_state_v2_${userEmail}`;
        const keyV1 = `luno_unit1_1_state_v2_${userEmail}`;
        const raw = localStorage.getItem(id === '1.1' ? keyV1 : keyV2) || localStorage.getItem(keyV2);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.pretestSubmitted) preScore = parsed.pretestScore;
          if (parsed.posttestSubmitted) postScore = parsed.posttestScore;
          if (typeof parsed.preScoreTotal === 'number') preScore = parsed.preScoreTotal;
          if (typeof parsed.postScoreTotal === 'number') postScore = parsed.postScoreTotal;
        }
      } catch {
        // ignore
      }
      if (id === unitId) {
        if (state.pretestSubmitted) preScore = state.pretestScore;
        if (state.posttestSubmitted) postScore = state.posttestScore;
      }

      return {
        id,
        title: def?.title || `หน่วย ${id}`,
        rubricScore: typeof evalScore === 'number' ? evalScore : null,
        preScore,
        postScore
      };
    });
  }, [
    blueprint.step5.isFinalCourseUnit,
    unitId,
    state.firstEvaluation,
    state.pretestSubmitted,
    state.pretestScore,
    state.posttestSubmitted,
    state.posttestScore,
    existingSubmission,
    allSubmissions,
    userEmail
  ]);

  const stages: { key: StageKey; label: string; time: string; done: boolean }[] = [
    { key: 'pretest', label: 'ก่อนเริ่ม: แบบวัดก่อนเรียน', time: '8 น.', done: state.pretestSubmitted },
    { key: 'step1', label: 'ขั้นที่ 1: เปิดสถานการณ์', time: blueprint.step1.timeText, done: !!state.step1ChoiceId && state.preConfidence > 0 },
    {
      key: 'step2',
      label: 'ขั้นที่ 2: เรียนรู้เนื้อหาย่อย',
      time: blueprint.step2.timeText,
      done:
        state.openedCards.length >= blueprint.step2.infographicCards.length &&
        Object.keys(state.sortingAnswers).length >= blueprint.step2.sortingItems.length
    },
    {
      key: 'step3',
      label: 'ขั้นที่ 3: ดูตัวอย่าง',
      time: blueprint.step3.timeText,
      done: state.tappedHotspots.length >= blueprint.step3.hotspots.length
    },
    { key: 'step4', label: 'ขั้นที่ 4: ลงมือปฏิบัติ', time: blueprint.step4.timeText, done: state.draftSaved },
    { key: 'step5', label: 'ขั้นที่ 5: ตรวจสอบ ส่งงาน สะท้อนคิด', time: blueprint.step5.timeText, done: state.firstSubmitted },
    { key: 'posttest', label: 'หลังจบ: แบบวัดหลังเรียน', time: '8 น.', done: state.posttestSubmitted }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Unit Header & Overview Card */}
      <div
        className="card"
        style={{
          padding: '22px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          borderRadius: '18px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38BDF8',
                fontSize: '0.78rem',
                fontWeight: 700,
                marginBottom: '8px'
              }}
            >
              คู่มือกิจกรรมประจำหน่วย • ระบบประเมินรูบริก 4 เกณฑ์ (10 คะแนน) + SJT คู่ขนาน ก/ข (9 คะแนน)
            </span>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 6px 0' }}>{blueprint.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.88rem' }}>
              <Clock size={15} />
              <span>เวลารวม: {blueprint.totalTimeText}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.08)',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ color: '#94A3B8' }}>แบบวัดก่อนเรียน (ฉบับ {state.assignedPreForm === 'A' ? 'ก' : 'ข'})</div>
              <div style={{ fontWeight: 800, color: state.pretestSubmitted ? '#38BDF8' : '#FBBF24' }}>
                {state.pretestSubmitted ? `${state.pretestScore} / 9 คะแนน` : 'ยังไม่ได้ทำ'}
              </div>
            </div>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.08)',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ color: '#94A3B8' }}>คะแนนชิ้นงาน (Rubric)</div>
              <div style={{ fontWeight: 800, color: state.firstEvaluation ? '#34D399' : '#E2E8F0' }}>
                {state.firstEvaluation ? `${state.firstEvaluation.totalScore} / 10 คะแนน` : 'รอส่งงานขั้นที่ 5'}
              </div>
            </div>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.08)',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ color: '#94A3B8' }}>แบบวัดหลังเรียน (ฉบับ {postFormCode === 'A' ? 'ก' : 'ข'})</div>
              <div style={{ fontWeight: 800, color: state.posttestSubmitted ? '#4ADE80' : '#E2E8F0' }}>
                {state.posttestSubmitted ? `${state.posttestScore} / 9 คะแนน` : 'รอทำหลังจบหน่วย'}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.06)',
            fontSize: '0.84rem',
            lineHeight: 1.6,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '10px'
          }}
        >
          <div>
            <strong style={{ color: '#38BDF8' }}>จุดประสงค์การเรียนรู้:</strong>
            <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
              {blueprint.objectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </div>
          <div>
            <div>
              <strong style={{ color: '#FBBF24' }}>สิ่งที่ผู้เรียนจะได้:</strong> {blueprint.outcomesText}
            </div>
            <div style={{ marginTop: '4px' }}>
              <strong style={{ color: '#A78BFA' }}>สิ่งที่ต้องเตรียม:</strong> {blueprint.preparationText}
            </div>
            <div style={{ marginTop: '4px', color: '#FDE68A' }}>
              <ShieldAlert size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              <strong>ข้อกำหนด PDPA:</strong> {blueprint.pdpaNoticeText}
            </div>
          </div>
        </div>
      </div>

      {/* 7-Stage Stepper Navigation */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {stages.map(st => {
          const isCurrent = activeStage === st.key;
          const isLocked = st.key !== 'pretest' && !state.pretestSubmitted;
          return (
            <button
              key={st.key}
              disabled={isLocked}
              onClick={() => {
                setStatusBanner(null);
                setActiveStage(st.key);
              }}
              style={{
                flex: '1 0 auto',
                padding: '10px 12px',
                borderRadius: '12px',
                border: isCurrent ? '2px solid #2563EB' : '1px solid #CBD5E1',
                background: isCurrent ? '#EFF6FF' : st.done ? '#F0FDF4' : '#FFFFFF',
                color: isLocked ? '#94A3B8' : isCurrent ? '#1D4ED8' : '#334155',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{st.label}</span>
                {st.done && <CheckCircle2 size={15} color="#16A34A" />}
              </div>
              <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '2px' }}>{st.time}</div>
            </button>
          );
        })}
      </div>

      {statusBanner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            color: '#92400E',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={18} />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* =====================================================================
          STAGE 0: PRE-TEST (แบบวัดก่อนเรียน 8 นาที)
         ===================================================================== */}
      {activeStage === 'pretest' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                ก่อนเริ่ม: แบบวัดก่อนเรียน (ฉบับ {state.assignedPreForm === 'A' ? 'ก' : 'ข'}) — เวลา 8 นาที
              </h4>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                {blueprint.sjtObjectiveWeightsText}
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: '#475569' }}>
              แบบวัดตัดสินใจในสถานการณ์ (SJT) 7 ข้อ (ข้อ 1–6 เลือกคำตอบ 4 ตัวเลือก ข้อละ 1 คะแนน • ข้อ 7 เขียนตอบสั้น 3 คะแนน รวม 9 คะแนน)
              ระบบสุ่มสลับฉบับ ก/ข และยังไม่แสดงเฉลยในขั้นก่อนเรียน
            </p>
          </div>

          {preFormQuestions.map((q, idx) => {
            const showScenarioHeader =
              idx === 0 || preFormQuestions[idx - 1].scenarioTitle !== q.scenarioTitle;
            return (
              <div key={q.number} style={{ marginBottom: '20px' }}>
                {showScenarioHeader && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      borderLeft: '4px solid #2563EB',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#1E3A8A', fontSize: '0.95rem', marginBottom: '4px' }}>
                      {q.scenarioTitle}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                      {q.scenarioContext}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <strong style={{ color: '#0F172A', fontSize: '0.94rem' }}>{q.questionText}</strong>
                    <span style={{ fontSize: '0.76rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                      จุดประสงค์ที่ {q.objectiveIndex} ({q.maxScore} คะแนน)
                    </span>
                  </div>

                  {q.type === 'mcq' && q.options ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {q.options.map(opt => {
                        const selected = state.pretestMcqAnswers[q.number] === opt.label;
                        return (
                          <label
                            key={opt.label}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              border: selected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                              background: selected ? '#EFF6FF' : '#FFFFFF',
                              cursor: state.pretestSubmitted ? 'default' : 'pointer',
                              fontSize: '0.88rem'
                            }}
                          >
                            <input
                              type="radio"
                              name={`pre_q_${q.number}`}
                              disabled={state.pretestSubmitted}
                              checked={selected}
                              onChange={() =>
                                setState(prev => ({
                                  ...prev,
                                  pretestMcqAnswers: { ...prev.pretestMcqAnswers, [q.number]: opt.label }
                                }))
                              }
                              style={{ marginTop: '3px' }}
                            />
                            <span>
                              <strong>{opt.label}.</strong> {opt.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        rows={3}
                        disabled={state.pretestSubmitted}
                        value={state.pretestWrittenAnswer}
                        onChange={e => setState(prev => ({ ...prev, pretestWrittenAnswer: e.target.value }))}
                        placeholder="พิมพ์คำตอบของท่าน (ไม่เกิน 2–3 บรรทัด)..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!state.pretestSubmitted ? (
            <button
              onClick={handlePretestSubmit}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={18} />
              <span>บันทึกแบบวัดก่อนเรียน และเข้าสู่ขั้นที่ 1</span>
            </button>
          ) : (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <strong style={{ color: '#166534' }}>
                  บันทึกผลแบบวัดก่อนเรียนแล้ว: ได้ {state.pretestScore} / 9 คะแนน (ฉบับ {state.assignedPreForm === 'A' ? 'ก' : 'ข'})
                </strong>
                <div style={{ fontSize: '0.83rem', color: '#15803D', marginTop: '4px' }}>
                  ระบบเก็บคะแนนรายจุดประสงค์ไว้เปรียบเทียบกับแบบวัดหลังเรียน และจะเปิดเฉลยพร้อมคำอธิบายตัวลวงหลังทำแบบวัดหลังเรียนเสร็จ
                </div>
              </div>
              <button
                onClick={() => setActiveStage('step1')}
                className="btn-primary"
                style={{ padding: '10px 18px', borderRadius: '10px', fontWeight: 700 }}
              >
                ไปขั้นที่ 1: เปิดสถานการณ์ →
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STAGE 1: เปิดสถานการณ์
         ===================================================================== */}
      {activeStage === 'step1' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
              ขั้นที่ 1: เปิดสถานการณ์ ({blueprint.step1.timeText})
            </span>
            <h4 style={{ margin: '4px 0', fontSize: '1.15rem', fontWeight: 800 }}>เป้าหมาย: {blueprint.step1.goalText}</h4>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '14px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE'
            }}
          >
            <div style={{ fontWeight: 800, color: '#1E3A8A', marginBottom: '6px' }}>{blueprint.step1.contextTitle}</div>
            <div style={{ fontSize: '0.92rem', color: '#1E293B', whiteSpace: 'pre-line', lineHeight: 1.65 }}>
              {blueprint.step1.contextDescription}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: '10px', color: '#0F172A' }}>{blueprint.step1.questionPrompt}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {blueprint.step1.options.map(opt => {
                const isSelected = state.step1ChoiceId === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setState(prev => ({ ...prev, step1ChoiceId: opt.id }))}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                      background: isSelected ? '#F8FAFC' : '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem' }}>{opt.label}</div>
                    {isSelected && opt.immediateConsequence && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: opt.isRecommended ? '#DCFCE7' : '#FEF3C7',
                          color: opt.isRecommended ? '#166534' : '#92400E',
                          fontSize: '0.86rem'
                        }}
                      >
                        <strong>ผลที่เกิดขึ้น:</strong> {opt.immediateConsequence}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {state.step1ChoiceId && blueprint.step1.recommendedNote && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  border: '1px solid #86EFAC',
                  color: '#166534',
                  fontSize: '0.86rem'
                }}
              >
                {blueprint.step1.recommendedNote}
              </div>
            )}
          </div>

          {blueprint.step1.extraSurveyPrompts && blueprint.step1.extraSurveyPrompts.length > 0 && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <strong style={{ color: '#0F172A', fontSize: '0.94rem' }}>
                สำรวจข้อมูลตั้งต้นของโรงเรียนท่าน (ระบบจะนำไปแสดงในขั้นที่ 4 และขั้นที่ 5.4)
              </strong>
              {blueprint.step1.extraSurveyPrompts.map(sp => (
                <div key={sp.key}>
                  <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    {sp.label}
                  </label>
                  <input
                    type="text"
                    value={state.step1SurveyAnswers[sp.key] || ''}
                    onChange={e =>
                      setState(prev => ({
                        ...prev,
                        step1SurveyAnswers: { ...prev.step1SurveyAnswers, [sp.key]: e.target.value }
                      }))
                    }
                    placeholder={sp.placeholder}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Confidence Rating 1-5 */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '10px', color: '#0F172A' }}>
              {blueprint.step1.confidencePrompt}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setState(prev => ({ ...prev, preConfidence: val }))}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: state.preConfidence === val ? '2px solid #2563EB' : '1px solid #CBD5E1',
                    background: state.preConfidence === val ? '#2563EB' : '#FFFFFF',
                    color: state.preConfidence === val ? '#FFFFFF' : '#334155',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ระดับ {val} {val === 1 ? '(น้อยที่สุด)' : val === 5 ? '(มั่นใจมาก)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setActiveStage('step2')}
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}
            >
              ไปขั้นที่ 2: เรียนรู้เนื้อหาย่อย →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2: เรียนรู้เนื้อหาย่อย
         ===================================================================== */}
      {activeStage === 'step2' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
              ขั้นที่ 2: เรียนรู้เนื้อหาย่อย ({blueprint.step2.timeText})
            </span>
            <h4 style={{ margin: '4px 0', fontSize: '1.15rem', fontWeight: 800 }}>เป้าหมาย: {blueprint.step2.goalText}</h4>
            <div style={{ fontSize: '0.84rem', color: '#64748B' }}>กรอบแนวคิด: {blueprint.theoryReference}</div>
          </div>

          {/* Tap-to-open Infographic Cards */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ color: '#0F172A' }}>{blueprint.step2.infographicTitle}</strong>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background:
                    state.openedCards.length >= blueprint.step2.infographicCards.length ? '#DCFCE7' : '#FEF3C7',
                  color: state.openedCards.length >= blueprint.step2.infographicCards.length ? '#166534' : '#92400E'
                }}
              >
                แตะเปิดแล้ว {state.openedCards.length} / {blueprint.step2.infographicCards.length} การ์ด
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {blueprint.step2.infographicCards.map(card => {
                const isOpen = state.openedCards.includes(card.id);
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (!isOpen) {
                        setState(prev => ({ ...prev, openedCards: [...prev.openedCards, card.id] }));
                      }
                    }}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: isOpen ? '2px solid #2563EB' : '1px dashed #94A3B8',
                      background: isOpen ? '#F8FAFC' : '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: '#1E3A8A', fontSize: '0.94rem' }}>{card.title}</strong>
                      {isOpen ? <CheckCircle2 size={16} color="#16A34A" /> : <Eye size={16} color="#64748B" />}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>{card.subtitle}</div>
                    {isOpen ? (
                      <ul style={{ margin: '10px 0 0 18px', padding: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.6 }}>
                        {card.points.map((pt, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#2563EB', fontWeight: 600 }}>
                        คลิกเพื่อเปิดอ่านรายละเอียด →
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Sorting Activity */}
          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <strong style={{ color: '#0F172A' }}>{blueprint.step2.sortingTitle}</strong>
              <button
                type="button"
                onClick={() =>
                  setState(prev => ({
                    ...prev,
                    sortingAnswers: {},
                    sortingRetryCount: prev.sortingRetryCount + 1
                  }))
                }
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RotateCcw size={13} /> ลองจัดหมวดหมู่ใหม่ (ลองซ้ำ {state.sortingRetryCount} ครั้ง)
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {blueprint.step2.sortingItems.map(item => {
                const chosenCat = state.sortingAnswers[item.id];
                const isCorrect = chosenCat === item.correctCategory;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>
                      {item.text}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {blueprint.step2.sortingCategories.map(cat => {
                        const active = chosenCat === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              setState(prev => ({
                                ...prev,
                                sortingAnswers: { ...prev.sortingAnswers, [item.id]: cat }
                              }))
                            }
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: active ? '2px solid #2563EB' : '1px solid #CBD5E1',
                              background: active ? '#EFF6FF' : '#FFFFFF',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                    {chosenCat && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: isCorrect ? '#DCFCE7' : '#FEF3C7',
                          color: isCorrect ? '#166534' : '#92400E',
                          fontSize: '0.83rem'
                        }}
                      >
                        <strong>{isCorrect ? '✓ ถูกต้อง!' : `✗ ยังไม่ตรง (เฉลยคือ “${item.correctCategory}”):`}</strong>{' '}
                        {item.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setActiveStage('step1')}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
            >
              ← ย้อนกลับขั้นที่ 1
            </button>
            <button
              onClick={() => setActiveStage('step3')}
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}
            >
              ไปขั้นที่ 3: ดูตัวอย่าง →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3: ดูตัวอย่าง
         ===================================================================== */}
      {activeStage === 'step3' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
              ขั้นที่ 3: ดูตัวอย่าง ({blueprint.step3.timeText})
            </span>
            <h4 style={{ margin: '4px 0', fontSize: '1.15rem', fontWeight: 800 }}>เป้าหมาย: {blueprint.step3.goalText}</h4>
          </div>

          {/* Worked Example with Hotspots */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ color: '#0F172A' }}>{blueprint.step3.exampleTitle}</strong>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background:
                    state.tappedHotspots.length >= blueprint.step3.hotspots.length ? '#DCFCE7' : '#EFF6FF',
                  color: state.tappedHotspots.length >= blueprint.step3.hotspots.length ? '#166534' : '#1D4ED8'
                }}
              >
                แตะดูแล้ว {state.tappedHotspots.length} / {blueprint.step3.hotspots.length} จุด
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {blueprint.step3.hotspots.map((hs, idx) => {
                const tapped = state.tappedHotspots.includes(hs.id);
                return (
                  <div
                    key={hs.id}
                    onClick={() => {
                      if (!tapped) {
                        setState(prev => ({ ...prev, tappedHotspots: [...prev.tappedHotspots, hs.id] }));
                      }
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: tapped ? '2px solid #16A34A' : '1px solid #CBD5E1',
                      background: tapped ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#0F172A', fontSize: '0.92rem' }}>
                        จุดแตะที่ {idx + 1}: {hs.field}{' '}
                        <span style={{ fontWeight: 500, color: '#64748B', fontSize: '0.8rem' }}>({hs.hint})</span>
                      </strong>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: tapped ? '#16A34A' : '#2563EB'
                        }}
                      >
                        {tapped ? '✓ เปิดคำอธิบายแล้ว' : 'แตะเพื่อดูคำอธิบาย'}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: '#F8FAFC',
                        fontSize: '0.88rem',
                        color: '#1E293B',
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {hs.exampleText}
                    </div>
                    {tapped && (
                      <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                        💡 ทำไมส่วนนี้จึงดี: {hs.hotspotExplanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spot-the-Flaw Activity */}
          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              background: '#FFFBEB',
              border: '1px solid #FDE68A'
            }}
          >
            <strong style={{ color: '#92400E', display: 'block', marginBottom: '4px' }}>
              {blueprint.step3.flawActivityTitle}
            </strong>
            <div style={{ fontSize: '0.85rem', color: '#B45309', marginBottom: '12px' }}>
              {blueprint.step3.flawActivityInstruction}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {blueprint.step3.flawItems.map(flaw => {
                const selected = state.selectedFlaws.includes(flaw.id);
                return (
                  <div
                    key={flaw.id}
                    onClick={() => {
                      if (!selected) {
                        setState(prev => ({ ...prev, selectedFlaws: [...prev.selectedFlaws, flaw.id] }));
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#FFFFFF',
                      border: selected
                        ? flaw.isFlawed
                          ? '2px solid #DC2626'
                          : '2px solid #16A34A'
                        : '1px solid #E2E8F0',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A' }}>
                      [{flaw.field}] {flaw.text}
                    </div>
                    {selected && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '0.83rem',
                          color: flaw.isFlawed ? '#B91C1C' : '#15803D',
                          fontWeight: 600
                        }}
                      >
                        {flaw.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setActiveStage('step2')}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
            >
              ← ย้อนกลับขั้นที่ 2
            </button>
            <button
              onClick={() => setActiveStage('step4')}
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}
            >
              ไปขั้นที่ 4: ลงมือปฏิบัติ →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 4: ลงมือปฏิบัติ + เหตุการณ์แทรก
         ===================================================================== */}
      {activeStage === 'step4' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
              ขั้นที่ 4: ลงมือปฏิบัติ ({blueprint.step4.timeText})
            </span>
            <h4 style={{ margin: '4px 0', fontSize: '1.15rem', fontWeight: 800 }}>เป้าหมาย: {blueprint.step4.goalText}</h4>
            <div
              style={{
                marginTop: '8px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                fontSize: '0.86rem',
                color: '#1E3A8A',
                lineHeight: 1.6
              }}
            >
              {blueprint.step4.instructionBanner}
            </div>
          </div>

          {/* Reference Box from Step 1 / Cross-Unit */}
          {(Object.keys(state.step1SurveyAnswers).length > 0 || crossUnit2_2Summary || unitId === '4.2') && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                fontSize: '0.84rem'
              }}
            >
              <strong style={{ color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                📌 ข้อมูลอ้างอิงสำหรับใช้ประกอบการกรอกแผนในขั้นที่ 4:
              </strong>
              {Object.entries(state.step1SurveyAnswers).map(([k, v]) =>
                v ? (
                  <div key={k} style={{ color: '#334155', marginBottom: '4px' }}>
                    • ข้อมูลจากขั้นที่ 1: <em>“{v}”</em>
                  </div>
                ) : null
              )}
              {crossUnit2_2Summary && (
                <div style={{ color: '#1E3A8A', marginBottom: '4px' }}>
                  • <strong>ผลประเมินความพร้อมดิจิทัล 3 ด้านจากหน่วย 2.2 ของท่าน:</strong> {crossUnit2_2Summary}
                </div>
              )}
              {unitId === '4.2' && (
                <div style={{ marginTop: '6px', padding: '10px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <strong>📋 แบบวัดความมั่นใจในการใช้เทคโนโลยีของครู 5 ข้อ (คะแนน 1 = น้อยที่สุด ถึง 5 = มากที่สุด):</strong>
                  <div style={{ color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
                    1) ฉันใช้เครื่องมือดิจิทัลที่โรงเรียนกำหนดกับงานประจำได้ด้วยตนเอง • 2) เมื่อกดผิดหรือติดขัด ฉันลองแก้เบื้องต้นหรือรู้ว่าจะถามใคร • 3) เครื่องมือนี้ช่วยให้งานของฉันเสร็จเร็วขึ้นหรือดีขึ้นจริง • 4) ฉันกล้าลองใช้เครื่องมือนี้กับงานจริงของชั้นเรียน • 5) ฉันสามารถแนะนำเพื่อนครูให้เริ่มใช้ขั้นพื้นฐานได้
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Practice Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {blueprint.step4.fields.map(field => {
              const val = state.formData[field.key] || '';
              const hasTitleWarning = field.warnIfStartsWithPersonTitle && PERSON_TITLE_REGEX.test(val);
              const hasBroadWarning = field.warnIfBroadVisionWords && BROAD_VISION_WORDS_REGEX.test(val);
              const hasWhyNotWarning = field.warnIfWhyNotQuestion && WHY_NOT_QUESTION_REGEX.test(val);

              return (
                <div key={field.key}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginBottom: '6px' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select
                      value={val}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          formData: { ...prev.formData, [field.key]: e.target.value }
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem'
                      }}
                    >
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'text' ? (
                    <input
                      type="text"
                      value={val}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          formData: { ...prev.formData, [field.key]: e.target.value }
                        }))
                      }
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem'
                      }}
                    />
                  ) : (
                    <textarea
                      rows={field.rows || 3}
                      value={val}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          formData: { ...prev.formData, [field.key]: e.target.value }
                        }))
                      }
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        lineHeight: 1.55
                      }}
                    />
                  )}

                  {hasTitleWarning && (
                    <div style={{ marginTop: '4px', color: '#B45309', fontSize: '0.8rem', fontWeight: 600 }}>
                      ⚠️ แจ้งเตือน PDPA: ระบบพบคำนำหน้าชื่อบุคคล (นาย/นาง/นางสาว/ด.ช./ด.ญ.) กรุณาใช้ “บทบาท” หรือ “รหัส” แทนชื่อจริง
                    </div>
                  )}
                  {hasBroadWarning && (
                    <div style={{ marginTop: '4px', color: '#B45309', fontSize: '0.8rem', fontWeight: 600 }}>
                      ⚠️ แจ้งเตือนคำขวัญกว้าง: พบคำว่า “เป็นเลิศ / ก้าวไกล / ชั้นนำ / สู่สากล” แนะนำให้เปลี่ยนเป็นสิ่งที่นักเรียนทำได้จริงและบริบทโรงเรียน
                    </div>
                  )}
                  {hasWhyNotWarning && (
                    <div style={{ marginTop: '4px', color: '#B45309', fontSize: '0.8rem', fontWeight: 600 }}>
                      ⚠️ แจ้งเตือนการโค้ช: พบคำถามขึ้นต้นด้วย “ทำไมไม่...” ซึ่งอาจทำให้ครูปกป้องตัวเอง แนะนำให้เปลี่ยนเป็นคำถามเปิด เช่น “เกิดอะไรขึ้นบ้าง / ครูเห็นอะไรในนักเรียน”
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSaveStep4Draft}
            className="btn-primary"
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <FileText size={18} />
            <span>บันทึกร่าง และเปิดเหตุการณ์แทรก / สถานการณ์จำลองแชต</span>
          </button>

          {/* Injected Event / Role Chat Simulation */}
          {state.draftSaved && (
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                background: '#FFF7ED',
                border: '2px solid #FB923C'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9A3412', fontWeight: 800, marginBottom: '10px' }}>
                <MessageSquare size={20} />
                <span>{blueprint.step4.injectedEvent.senderLabel}</span>
              </div>

              {activeRoleSequence ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '0.88rem', color: '#7C2D12', fontWeight: 700 }}>
                    {activeRoleSequence.roleLabel} — ตอบข้อความ 3 ข้อความต่อเนื่อง (เมื่อตอบข้อความแรกแล้ว ข้อความถัดไปจะปรากฏขึ้น)
                  </div>
                  {activeRoleSequence.messages.map(msg => {
                    const isUnlocked = msg.index === 1 || (state.roleChatReplies[msg.index - 1] || '').trim().length >= 5;
                    if (!isUnlocked) return null;
                    return (
                      <div
                        key={msg.index}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: '#FFFFFF',
                          border: '1px solid #FDBA74'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: '6px' }}>
                          💬 {msg.incomingText}
                        </div>
                        <textarea
                          rows={2}
                          value={state.roleChatReplies[msg.index] || ''}
                          onChange={e =>
                            setState(prev => ({
                              ...prev,
                              roleChatReplies: { ...prev.roleChatReplies, [msg.index]: e.target.value }
                            }))
                          }
                          placeholder={`พิมพ์คำตอบข้อความที่ ${msg.index} แบบสองทาง (รับรู้ • ตอบตรงประเด็น • สิ่งที่จะทำต่อพร้อมเวลา • เปิดให้คุยต่อ)...`}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.88rem'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#FFFFFF',
                      border: '1px solid #FDBA74',
                      fontSize: '0.9rem',
                      color: '#0F172A',
                      marginBottom: '10px'
                    }}
                  >
                    💬 <strong>ข้อความที่เข้ามา:</strong> {blueprint.step4.injectedEvent.incomingMessage}
                  </div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', color: '#9A3412', marginBottom: '6px' }}>
                    {blueprint.step4.injectedEvent.replyPrompt}
                  </label>
                  <textarea
                    rows={3}
                    value={state.injectedReply}
                    onChange={e => setState(prev => ({ ...prev, injectedReply: e.target.value }))}
                    placeholder="พิมพ์คำตอบของท่าน และกลับไปปรับแผนด้านบนหากข้อมูลใหม่ทำให้แผนเดิมต้องปรับ..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setActiveStage('step3')}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
            >
              ← ย้อนกลับขั้นที่ 3
            </button>
            <button
              onClick={() => {
                handleSaveStep4Draft();
                setActiveStage('step5');
              }}
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}
            >
              ไปขั้นที่ 5: ตรวจสอบ ส่งงาน สะท้อนคิด →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 5: ตรวจสอบ ส่งงาน สะท้อนคิด
         ===================================================================== */}
      {activeStage === 'step5' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
              ขั้นที่ 5: ตรวจสอบ ส่งงาน สะท้อนคิด ({blueprint.step5.timeText})
            </span>
            <h4 style={{ margin: '4px 0', fontSize: '1.15rem', fontWeight: 800 }}>เป้าหมาย: {blueprint.step5.goalText}</h4>
          </div>

          {/* 5.1 Self-Assessment & Checklist */}
          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0'
            }}
          >
            <strong style={{ color: '#0F172A', display: 'block', marginBottom: '10px' }}>
              ขั้น 5.1: ประเมินตนเองตามเกณฑ์รูบริก 4 ข้อ (รวม 10 คะแนน) และตรวจ Checklist ก่อนส่งงาน
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              {unitDef?.rubric.map(r => (
                <div
                  key={r.id}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>
                      {r.title} (เต็ม {r.maxScore} คะแนน)
                    </strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[r.low.score, r.medium.score, r.high.score].map((sc, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setState(prev => ({ ...prev, selfRatings: { ...prev.selfRatings, [r.id]: sc } }))
                          }
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: state.selfRatings[r.id] === sc ? '2px solid #2563EB' : '1px solid #CBD5E1',
                            background: state.selfRatings[r.id] === sc ? '#EFF6FF' : '#FFFFFF',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {sc} คะแนน
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
                    <strong>เกณฑ์ระดับดีมาก:</strong> {r.high.desc}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {autoCheckResults.map((ac, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: ac.passed ? '#166534' : '#B45309' }}>
                  {ac.passed ? <CheckCircle2 size={16} color="#16A34A" /> : <AlertTriangle size={16} color="#D97706" />}
                  <span>{ac.label}</span>
                </div>
              ))}
              {blueprint.step5.manualChecklistItems.map((mc, idx) => {
                const checked = !!state.manualChecks[idx];
                return (
                  <div
                    key={idx}
                    onClick={() =>
                      setState(prev => ({
                        ...prev,
                        manualChecks: { ...prev.manualChecks, [idx]: !checked }
                      }))
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.86rem',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    {checked ? <CheckSquare size={16} color="#2563EB" /> : <Square size={16} color="#64748B" />}
                    <span>{mc} (ผู้เรียนตรวจเอง)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5.2 Submit & Reveal Model Answers */}
          <div>
            {!state.firstSubmitted ? (
              <button
                type="button"
                onClick={handleFirstSubmitWork}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Send size={18} />
                <span>ขั้น 5.2: กดส่งงาน (ระบบล็อกฉบับส่งครั้งแรกเพื่อคิดคะแนน และเปิดแนวคำตอบ)</span>
              </button>
            ) : (
              <div
                style={{
                  padding: '18px',
                  borderRadius: '14px',
                  background: '#F0FDF4',
                  border: '2px solid #22C55E',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <strong style={{ color: '#14532D', fontSize: '1rem' }}>
                    ✓ ผลการประเมินฉบับส่งครั้งแรก: ได้ {state.firstEvaluation?.totalScore ?? 0} / 10 คะแนน
                  </strong>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: '#DCFCE7',
                      color: '#166534',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}
                  >
                    ล็อกคะแนนฉบับแรกแล้ว • แก้ไขเพิ่มในขั้น 5.3 เพื่อบันทึก PDF ได้
                  </span>
                </div>

                {state.firstEvaluation?.feedbacks.map(fb => (
                  <div
                    key={fb.criterionId}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      border: '1px solid #BBF7D0',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>
                      {fb.title}: {fb.score} / {fb.maxScore} คะแนน
                    </div>
                    <div style={{ color: '#334155', marginTop: '2px' }}>{fb.comment}</div>
                  </div>
                ))}

                {/* Revealed Model Answer & Must-Catch Guide */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#EFF6FF',
                    border: '1px solid #93C5FD',
                    fontSize: '0.86rem',
                    color: '#1E3A8A'
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '6px' }}>
                    🔑 แนวคำตอบและจุดที่ต้องจับ (เปิดให้เทียบหลังส่งงาน):
                  </strong>
                  {activeRoleSequence ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {activeRoleSequence.messages.map(m => (
                        <div key={m.index}>
                          <div>
                            <strong>ข้อความที่ {m.index} แนวคำตอบที่ดี:</strong> {m.goodAnswerGuide}
                          </div>
                          <div style={{ color: '#1D4ED8', fontSize: '0.82rem' }}>จุดที่ต้องจับ: {m.mustCatch}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div>
                        <strong>แนวคำตอบที่ดีของเหตุการณ์แทรก:</strong> {blueprint.step4.injectedEvent.goodResponseGuide}
                      </div>
                      <div style={{ marginTop: '4px', color: '#B91C1C' }}>
                        <strong>สิ่งที่ควรหลีกเลี่ยง:</strong> {blueprint.step4.injectedEvent.avoidGuide}
                      </div>
                    </>
                  )}
                </div>

                {/* 5.3 Revise Once & Export A4 PDF */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveStage('step4')}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid #2563EB',
                      background: '#FFFFFF',
                      color: '#2563EB',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✎ ขั้น 5.3: กลับไปปรับแก้แผน 1 ครั้ง
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRevisionForPdf}
                    className="btn-primary"
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <FileText size={16} />
                    <span>ดาวน์โหลดชิ้นงานฉบับแก้เป็น PDF (A4)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Special Course-Wide 10-Unit Summary Dashboard for Unit 4.2 */}
          {blueprint.step5.isFinalCourseUnit && (
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                color: '#FFFFFF'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Trophy size={22} color="#FBBF24" />
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  ตารางสรุปผลรวมทั้งหลักสูตร 10 หน่วย (เกณฑ์ผ่านหลักสูตร: ครบ 10 หน่วย และได้คะแนนรูบริกรวม ≥ 80 / 100)
                </h4>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>หน่วย</th>
                      <th style={{ padding: '8px' }}>คะแนนชิ้นงาน (เต็ม 10)</th>
                      <th style={{ padding: '8px' }}>แบบวัดก่อนเรียน (เต็ม 9)</th>
                      <th style={{ padding: '8px' }}>แบบวัดหลังเรียน (เต็ม 9)</th>
                      <th style={{ padding: '8px' }}>พัฒนาการ (Δ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseWideSummaryRows.map(row => {
                      const delta =
                        row.preScore !== null && row.postScore !== null ? row.postScore - row.preScore : null;
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{row.title}</td>
                          <td style={{ padding: '8px' }}>
                            {row.rubricScore !== null ? `${row.rubricScore} / 10` : 'รอส่งงาน'}
                          </td>
                          <td style={{ padding: '8px' }}>{row.preScore !== null ? `${row.preScore} / 9` : '-'}</td>
                          <td style={{ padding: '8px' }}>{row.postScore !== null ? `${row.postScore} / 9` : '-'}</td>
                          <td style={{ padding: '8px', color: delta !== null && delta >= 0 ? '#4ADE80' : '#F87171' }}>
                            {delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5.4 Reflection & Post-Confidence */}
          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <strong style={{ color: '#0F172A' }}>ขั้น 5.4: สะท้อนคิด 2 ข้อ และประเมินความมั่นใจหลังเรียน</strong>

            {state.step1ChoiceId && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#EFF6FF',
                  fontSize: '0.84rem',
                  color: '#1E3A8A'
                }}
              >
                <div>
                  <strong>คำตอบตั้งต้นของท่านในขั้นที่ 1:</strong>{' '}
                  {blueprint.step1.options.find(o => o.id === state.step1ChoiceId)?.label}
                </div>
                <div style={{ marginTop: '2px' }}>
                  <strong>ข้อคิดสะท้อน:</strong>{' '}
                  {blueprint.step1.options.find(o => o.id === state.step1ChoiceId)?.reflectionInStep5}
                </div>
              </div>
            )}

            {crossUnit4_1Vision && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#F0FDF4',
                  fontSize: '0.84rem',
                  color: '#166534'
                }}
              >
                <strong>วิสัยทัศน์ดิจิทัลที่ท่านร่างไว้ในหน่วย 4.1:</strong> “{crossUnit4_1Vision}”
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                {blueprint.step5.reflectionPrompt1}
              </label>
              <textarea
                rows={2}
                value={state.reflection1}
                onChange={e => setState(prev => ({ ...prev, reflection1: e.target.value }))}
                placeholder="พิมพ์บันทึกสะท้อนคิดข้อที่ 1..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: '4px' }}>
                {blueprint.step5.reflectionPrompt2}
              </label>
              <textarea
                rows={2}
                value={state.reflection2}
                onChange={e => setState(prev => ({ ...prev, reflection2: e.target.value }))}
                placeholder="พิมพ์บันทึกสะท้อนคิดข้อที่ 2..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' }}>
                ให้คะแนนความมั่นใจหลังเรียน (1–5) {state.preConfidence > 0 ? `[ก่อนเรียน: ระดับ ${state.preConfidence}]` : ''}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, postConfidence: val }))}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: state.postConfidence === val ? '2px solid #16A34A' : '1px solid #CBD5E1',
                      background: state.postConfidence === val ? '#16A34A' : '#FFFFFF',
                      color: state.postConfidence === val ? '#FFFFFF' : '#334155',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ระดับ {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setActiveStage('step4')}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
            >
              ← ย้อนกลับขั้นที่ 4
            </button>
            <button
              onClick={() => setActiveStage('posttest')}
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}
            >
              ไปทำแบบวัดหลังเรียน (8 นาที) →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 6: POST-TEST (แบบวัดหลังเรียน 8 นาที + เฉลยคู่ขนาน ก/ข)
         ===================================================================== */}
      {activeStage === 'posttest' && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
              หลังจบ: แบบวัดหลังเรียน (ฉบับ {postFormCode === 'A' ? 'ก' : 'ข'} — คู่ขนานกับฉบับก่อนเรียน) เวลา 8 นาที
            </h4>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: '#475569' }}>
              เมื่อส่งแบบวัดหลังเรียนแล้ว ระบบจะแสดงตารางเปรียบเทียบคะแนนก่อน–หลังเรียนรายจุดประสงค์ พร้อมเฉลยและคำอธิบายตัวลวงครบทั้งฉบับ ก และฉบับ ข
            </p>
          </div>

          {postFormQuestions.map((q, idx) => {
            const showScenarioHeader =
              idx === 0 || postFormQuestions[idx - 1].scenarioTitle !== q.scenarioTitle;
            return (
              <div key={q.number} style={{ marginBottom: '12px' }}>
                {showScenarioHeader && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      borderLeft: '4px solid #16A34A',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#14532D', fontSize: '0.95rem', marginBottom: '4px' }}>
                      {q.scenarioTitle}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                      {q.scenarioContext}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <strong style={{ color: '#0F172A', fontSize: '0.94rem' }}>{q.questionText}</strong>
                    <span style={{ fontSize: '0.76rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                      จุดประสงค์ที่ {q.objectiveIndex} ({q.maxScore} คะแนน)
                    </span>
                  </div>

                  {q.type === 'mcq' && q.options ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {q.options.map(opt => {
                        const selected = state.posttestMcqAnswers[q.number] === opt.label;
                        return (
                          <label
                            key={opt.label}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              border: selected ? '2px solid #16A34A' : '1px solid #CBD5E1',
                              background: selected ? '#F0FDF4' : '#FFFFFF',
                              cursor: state.posttestSubmitted ? 'default' : 'pointer',
                              fontSize: '0.88rem'
                            }}
                          >
                            <input
                              type="radio"
                              name={`post_q_${q.number}`}
                              disabled={state.posttestSubmitted}
                              checked={selected}
                              onChange={() =>
                                setState(prev => ({
                                  ...prev,
                                  posttestMcqAnswers: { ...prev.posttestMcqAnswers, [q.number]: opt.label }
                                }))
                              }
                              style={{ marginTop: '3px' }}
                            />
                            <span>
                              <strong>{opt.label}.</strong> {opt.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={3}
                      disabled={state.posttestSubmitted}
                      value={state.posttestWrittenAnswer}
                      onChange={e => setState(prev => ({ ...prev, posttestWrittenAnswer: e.target.value }))}
                      placeholder="พิมพ์คำตอบของท่าน (ไม่เกิน 2–3 บรรทัด)..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem'
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {!state.posttestSubmitted ? (
            <button
              onClick={handlePosttestSubmit}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Award size={18} />
              <span>ส่งแบบวัดหลังเรียน และดูผลเปรียบเทียบก่อน–หลังเรียนพร้อมเฉลย</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Pre vs Post Summary Table */}
              <div
                style={{
                  padding: '18px',
                  borderRadius: '14px',
                  background: '#F0FDF4',
                  border: '2px solid #22C55E'
                }}
              >
                <strong style={{ color: '#14532D', fontSize: '1.05rem', display: 'block', marginBottom: '10px' }}>
                  📊 สรุปผลเปรียบเทียบคะแนนก่อนเรียนและหลังเรียน ({blueprint.title})
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>ก่อนเรียน (ฉบับ {state.assignedPreForm === 'A' ? 'ก' : 'ข'})</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A' }}>{state.pretestScore} / 9</div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>หลังเรียน (ฉบับ {postFormCode === 'A' ? 'ก' : 'ข'})</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16A34A' }}>{state.posttestScore} / 9</div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>ความก้าวหน้า (SJT Gain)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563EB' }}>
                      {state.posttestScore - state.pretestScore >= 0
                        ? `+${state.posttestScore - state.pretestScore}`
                        : state.posttestScore - state.pretestScore}{' '}
                      คะแนน
                    </div>
                  </div>
                </div>
              </div>

              {/* Parallel Answer Key Table (Form A & Form B) */}
              <div
                style={{
                  padding: '18px',
                  borderRadius: '14px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1'
                }}
              >
                <strong style={{ color: '#0F172A', display: 'block', marginBottom: '12px' }}>
                  📖 เฉลยและคำอธิบายตัวลวงคู่ขนาน (ครบทั้งฉบับ ก และฉบับ ข)
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {blueprint.sjtFormA.map((qa, i) => {
                    const qb = blueprint.sjtFormB[i];
                    return (
                      <div
                        key={qa.number}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.84rem'
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#1E3A8A', marginBottom: '4px' }}>
                          ข้อ {qa.number} (จุดประสงค์ที่ {qa.objectiveIndex}): {qa.skillMeasured}
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>ฉบับ ก {qa.correctLabel ? `(เฉลย ${qa.correctLabel})` : '(ข้อเขียน 3 คะแนน)'}:</strong>{' '}
                          {qa.explanation} <span style={{ color: '#64748B' }}>({qa.distractorNote})</span>
                        </div>
                        {qb && (
                          <div>
                            <strong>ฉบับ ข {qb.correctLabel ? `(เฉลย ${qb.correctLabel})` : '(ข้อเขียน 3 คะแนน)'}:</strong>{' '}
                            {qb.explanation} <span style={{ color: '#64748B' }}>({qb.distractorNote})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  {onBackToDashboard && (
                    <button
                      type="button"
                      onClick={onBackToDashboard}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      กลับหน้าแดชบอร์ด
                    </button>
                  )}
                  {onNextUnit && (
                    <button
                      type="button"
                      onClick={onNextUnit}
                      className="btn-primary"
                      style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}
                    >
                      ไปหน่วยถัดไป →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {pdfModalOpen && unitDef && (
        <ArtifactPdfModal
          unit={unitDef}
          submission={{
            unitId,
            formData: {
              ...state.formData,
              คำตอบเหตุการณ์แทรก: state.injectedReply
            },
            rubricScores: state.firstEvaluation?.scores || existingSubmission?.rubricScores || {},
            totalScore: state.firstEvaluation?.totalScore ?? existingSubmission?.totalScore ?? 0,
            reflectionNotes: [state.reflection1, state.reflection2].filter(Boolean).join('\n'),
            submittedAt: existingSubmission?.submittedAt || new Date().toISOString()
          }}
          profile={profile}
          onClose={() => setPdfModalOpen(false)}
        />
      )}
    </div>
  );
};

export default UnifiedUnitInteractive;
