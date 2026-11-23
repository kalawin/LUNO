import React, { useState, useEffect } from 'react';
import type { UserProfile, UnitSubmission } from '../types';
import { UNITS_DATA } from '../data/modulesData';
import {
  SAMPLE_SCHOOL_CONTEXT,
  QUIZ_SCHOOL_CONTEXT,
  SCHOOL_CHANNELS_TABLE,
  SCENARIO_D_PRACTICE,
  STEP3_HOTSPOTS_D,
  STEP3_FLAWED_PLAN_D,
  STEP4_SCENARIOS_ABC,
  STEP1_BRANCHING_DATA,
  STEP2_INFOGRAPHIC_CARDS,
  STEP2_MATCHING_ITEMS,
  STEP2_CHANNEL_QUIZ,
  SJT_FORM_A,
  SJT_FORM_B,
  type SJTQuestion
} from '../data/unit1_1Data';
import { EvaluatorEngine } from '../utils/evaluatorEngine';
import { ArtifactPdfModal } from './ArtifactPdfModal';
import { SoundService } from '../services/audio';
import { InteractiveUnitVideoCard, VoiceNarratorButton } from './UnitRichMediaPanel';
import {
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Bell,
  MessageSquare,
  Sparkles,
  Printer,
  Send,
  Eye,
  Radio,
  Globe,
  ShieldCheck,
  Target,
  Award,
  Info
} from 'lucide-react';

interface Props {
  profile: UserProfile | null;
  existingSubmission?: UnitSubmission;
  onSubmitUnit: (sub: UnitSubmission) => void;
  onNextUnit?: () => void;
  onBackToDashboard?: () => void;
}

type StageId = 'pretest' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'posttest';

interface SelectedChannelEntry {
  channelId: string;
  reason: string;
}

interface PersistedUnit1_1State {
  currentStage: StageId;
  pdpaAccepted: boolean;
  // Counterbalanced SJT forms
  assignedPreForm: 'A' | 'B';
  preTestDone: boolean;
  preTestMcqAnswers: Record<number, 'ก' | 'ข' | 'ค' | 'ง'>;
  preTestWritten7: string;
  preTestScores?: { total: number; obj1: number; obj2: number; obj3: number };

  postTestDone: boolean;
  postTestMcqAnswers: Record<number, 'ก' | 'ข' | 'ค' | 'ง'>;
  postTestWritten7: string;
  postTestScores?: { total: number; obj1: number; obj2: number; obj3: number };

  // Step 1
  step1StartedAt?: string;
  branch1Choice?: string;
  branch1FirstChoice?: string;
  branch2Choice?: string;
  branch2FirstChoice?: string;
  branch2Attempts: number;
  confidenceBefore: number;

  // Step 2
  openedInfographics: string[];
  matchingAnswers: Record<string, string>;
  matchingAttempts: number;
  channelQuizAnswers: Record<string, 'ก' | 'ข' | 'ค'>;

  // Step 3
  openedHotspots: string[];
  selectedFlawIds: string[];
  showFlawSolution: boolean;
  flawsFoundBySelf: number;

  // Step 4
  selectedScenarioCode: 'A' | 'B' | 'C' | '';
  goalWho: string;
  goalAction: string;
  goalWhen: string;
  goalFullText: string;
  audienceMain: string;
  audienceSub: string;
  keyMessage: string;
  selectedChannels: SelectedChannelEntry[];
  draftSavedAt?: string;
  injectedReply: string;
  editCounts: Record<string, number>;

  // Step 5
  selfRubricScores: Record<string, number>;
  manualChecklist: {
    noUnconfirmedOrPdpa: boolean;
    previewChecked: boolean;
    injectedAnsweredConsistent: boolean;
  };
  firstLockedSubmission?: {
    scenarioCode: 'A' | 'B' | 'C';
    goal: string;
    audienceMain: string;
    audienceSub: string;
    keyMessage: string;
    channelsSummary: string;
    injectedReply: string;
    submittedAt: string;
    autoScores: Record<string, number>;
    autoTotal: number;
  };
  hasRevisedOnce: boolean;
  revisedPlan?: {
    goal: string;
    audienceMain: string;
    audienceSub: string;
    keyMessage: string;
    channelsSummary: string;
    injectedReply: string;
  };
  reflectionQ1: string;
  reflectionQ2: string;
  confidenceAfter: number;
}

const STORAGE_KEY = 'luno_unit1_1_interactive_v2';

function gradeWrittenQuestion7(formType: 'A' | 'B', text: string): { score: number; passedC1: boolean; passedC2: boolean; passedC3: boolean } {
  const cleaned = (text || '').trim();
  if (!cleaned) {
    return { score: 0, passedC1: false, passedC2: false, passedC3: false };
  }
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const q7 = (formType === 'A' ? SJT_FORM_A : SJT_FORM_B).find(q => q.number === 7);
  const wc = q7?.writtenCriteria;
  if (!wc) return { score: 0, passedC1: false, passedC2: false, passedC3: false };

  const passedC1 = wc.keywordsC1.test(cleaned);
  const passedC2 = wc.keywordsC2A.test(cleaned) && wc.keywordsC2B.test(cleaned);
  const passedC3 = lines.length >= 1 && lines.length <= 3 && cleaned.length >= 20 && cleaned.length <= 320;

  const score = (passedC1 ? 1 : 0) + (passedC2 ? 1 : 0) + (passedC3 ? 1 : 0);
  return { score, passedC1, passedC2, passedC3 };
}

function calculateSJTScore(
  formType: 'A' | 'B',
  mcqAnswers: Record<number, 'ก' | 'ข' | 'ค' | 'ง'>,
  written7: string
): { total: number; obj1: number; obj2: number; obj3: number; q7Detail: { score: number; passedC1: boolean; passedC2: boolean; passedC3: boolean } } {
  const questions = formType === 'A' ? SJT_FORM_A : SJT_FORM_B;
  let obj1 = 0;
  let obj2 = 0;
  let obj3 = 0;

  for (const q of questions) {
    if (q.type === 'mcq') {
      const isRight = mcqAnswers[q.number] === q.correctLabel;
      const pts = isRight ? 1 : 0;
      if (q.objectiveIndex === 1) obj1 += pts;
      else if (q.objectiveIndex === 2) obj2 += pts;
      else if (q.objectiveIndex === 3) obj3 += pts;
    }
  }

  const q7Detail = gradeWrittenQuestion7(formType, written7);
  obj3 += q7Detail.score;

  return {
    total: obj1 + obj2 + obj3,
    obj1,
    obj2,
    obj3,
    q7Detail
  };
}

export const Unit1_1Interactive: React.FC<Props> = ({
  profile,
  existingSubmission,
  onSubmitUnit,
  onNextUnit,
  onBackToDashboard
}) => {
  const unit = UNITS_DATA['1.1'];

  const [state, setState] = useState<PersistedUnit1_1State>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error(e);
    }
    const randomForm: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    return {
      currentStage: existingSubmission ? 'step5' : 'pretest',
      pdpaAccepted: true,
      assignedPreForm: randomForm,
      preTestDone: false,
      preTestMcqAnswers: {},
      preTestWritten7: '',
      postTestDone: false,
      postTestMcqAnswers: {},
      postTestWritten7: '',
      branch2Attempts: 0,
      confidenceBefore: 0,
      openedInfographics: [],
      matchingAnswers: {},
      matchingAttempts: 0,
      channelQuizAnswers: {},
      openedHotspots: [],
      selectedFlawIds: [],
      showFlawSolution: false,
      flawsFoundBySelf: 0,
      selectedScenarioCode: '',
      goalWho: '',
      goalAction: '',
      goalWhen: '',
      goalFullText: existingSubmission?.formData?.['เป้าหมาย'] || '',
      audienceMain: existingSubmission?.formData?.['ผู้รับสารหลัก'] || '',
      audienceSub: existingSubmission?.formData?.['ผู้รับสารรอง'] || '',
      keyMessage: existingSubmission?.formData?.['ข้อความหลัก'] || '',
      selectedChannels: [],
      injectedReply: existingSubmission?.formData?.['คำตอบเหตุการณ์แทรก'] || '',
      editCounts: {},
      selfRubricScores: {
        r1_goal: 2,
        r1_message: 3,
        r1_channel: 3,
        r1_reason_event: 2
      },
      manualChecklist: {
        noUnconfirmedOrPdpa: false,
        previewChecked: false,
        injectedAnsweredConsistent: false
      },
      hasRevisedOnce: false,
      reflectionQ1: '',
      reflectionQ2: '',
      confidenceAfter: 0
    };
  });

  const [showSchoolTableModal, setShowSchoolTableModal] = useState(false);
  const [collapseStep4SchoolInfo, setCollapseStep4SchoolInfo] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'line' | 'speaker' | 'fb'>('line');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [matchingFeedback, setMatchingFeedback] = useState<Record<string, { isCorrect: boolean; message: string }>>({});
  const [isEditingPostSubmit, setIsEditingPostSubmit] = useState(false);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to auto-save Unit 1.1 state:', e);
    }
  }, [state]);

  const updateState = (patch: Partial<PersistedUnit1_1State>) => {
    setState(prev => ({ ...prev, ...patch }));
  };

  const trackFieldEdit = (fieldKey: string) => {
    setState(prev => ({
      ...prev,
      editCounts: {
        ...prev.editCounts,
        [fieldKey]: (prev.editCounts[fieldKey] || 0) + 1
      }
    }));
  };

  const assignedPostForm: 'A' | 'B' = state.assignedPreForm === 'A' ? 'B' : 'A';
  const activeScenario = STEP4_SCENARIOS_ABC.find(s => s.code === state.selectedScenarioCode);

  // Count non-empty lines for keyMessage (1 sentence per line, max 3 lines)
  const keyMessageLines = state.keyMessage
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const keyMessageLineCount = keyMessageLines.length;

  // Format channels summary text
  const formattedChannelsText = state.selectedChannels
    .map(entry => {
      const ch = SCHOOL_CHANNELS_TABLE.find(c => c.id === entry.channelId);
      return `${ch?.name || entry.channelId}: ${entry.reason.trim()}`;
    })
    .join('\n');

  // Format checks for Step 4 & Step 5.1 Checklist
  const isGoalFilled =
    state.goalFullText.trim().length >= 10 &&
    (state.goalWho.trim().length > 0 || /(ผู้ปกครอง|ครอบครัว|นักเรียน|ครู|ครัวเรือน)/.test(state.goalFullText)) &&
    (state.goalWhen.trim().length > 0 || /(เวลา|ก่อน|ภายใน|วันนี้|พรุ่งนี้|เสาร์|อาทิตย์|จันทร์|พุธ|ศุกร์|น\.|[0-9])/.test(state.goalFullText));

  const isMessageLinesValid = keyMessageLineCount >= 1 && keyMessageLineCount <= 3 && state.keyMessage.trim().length >= 15;

  const isChannelsValid =
    state.selectedChannels.length >= 2 &&
    state.selectedChannels.length <= 3 &&
    state.selectedChannels.every(c => c.reason.trim().length >= 4);

  const isAudienceFilled = state.audienceMain.trim().length >= 4 && state.audienceSub.trim().length >= 4;

  const isInjectedReplyValid =
    !!state.draftSavedAt &&
    state.injectedReply.trim().length >= 8 &&
    state.injectedReply.split(/\r?\n/).filter(l => l.trim()).length <= 2;

  // Active plan data (uses revisedPlan if learner edited in Step 5.3)
  const activePlanForPdf = state.revisedPlan || {
    goal: state.goalFullText,
    audienceMain: state.audienceMain,
    audienceSub: state.audienceSub,
    keyMessage: state.keyMessage,
    channelsSummary: formattedChannelsText,
    injectedReply: state.injectedReply
  };

  const currentFormDataForEval = {
    'รหัสสถานการณ์': state.selectedScenarioCode || 'A',
    'สถานการณ์ที่เลือก': activeScenario ? `เรื่อง ${activeScenario.code}: ${activeScenario.shortLine}` : '',
    'เป้าหมาย': activePlanForPdf.goal,
    'ผู้รับสารหลัก': activePlanForPdf.audienceMain,
    'ผู้รับสารรอง': activePlanForPdf.audienceSub,
    'ข้อความหลัก': activePlanForPdf.keyMessage,
    'ช่องทางและเหตุผล': activePlanForPdf.channelsSummary,
    'คำตอบเหตุการณ์แทรก': activePlanForPdf.injectedReply
  };

  const evalResult = EvaluatorEngine.evaluate('1.1', currentFormDataForEval);

  const stagesMeta: { id: StageId; shortLabel: string; time: string; isDone: boolean }[] = [
    { id: 'pretest', shortLabel: 'ก่อนเรียน', time: '8 น.', isDone: state.preTestDone },
    { id: 'step1', shortLabel: '1. เปิดสถานการณ์', time: '4 น.', isDone: state.confidenceBefore > 0 && !!state.branch2Choice },
    {
      id: 'step2',
      shortLabel: '2. เนื้อหาย่อย',
      time: '7 น.',
      isDone:
        state.openedInfographics.length === 4 &&
        Object.keys(state.matchingAnswers).length === 4 &&
        Object.keys(state.channelQuizAnswers).length === 2
    },
    {
      id: 'step3',
      shortLabel: '3. ดูตัวอย่าง',
      time: '4 น.',
      isDone: state.openedHotspots.length === 4 && (state.selectedFlawIds.length >= 2 || state.showFlawSolution)
    },
    {
      id: 'step4',
      shortLabel: '4. ลงมือปฏิบัติ',
      time: '20 น.',
      isDone: isGoalFilled && isAudienceFilled && isMessageLinesValid && isChannelsValid && isInjectedReplyValid
    },
    {
      id: 'step5',
      shortLabel: '5. ส่งงาน & สะท้อนคิด',
      time: '10 น.',
      isDone: !!state.firstLockedSubmission && state.confidenceAfter > 0
    },
    { id: 'posttest', shortLabel: 'หลังเรียน', time: '8 น.', isDone: state.postTestDone }
  ];

  // Handlers for SJT Pre/Post test
  const handleSubmitPreTest = () => {
    const questions = state.assignedPreForm === 'A' ? SJT_FORM_A : SJT_FORM_B;
    const answeredMcqCount = Object.keys(state.preTestMcqAnswers).length;
    if (answeredMcqCount < 6 || !state.preTestWritten7.trim()) {
      alert('กรุณาทำข้อสอบข้อ 1–6 และเขียนข้อความในข้อ 7 ให้ครบทุกข้อก่อนส่งแบบวัดก่อนเรียนครับ');
      return;
    }
    const res = calculateSJTScore(state.assignedPreForm, state.preTestMcqAnswers, state.preTestWritten7);
    updateState({
      preTestDone: true,
      preTestScores: { total: res.total, obj1: res.obj1, obj2: res.obj2, obj3: res.obj3 },
      step1StartedAt: state.step1StartedAt || new Date().toISOString()
    });
    SoundService.playSuccess();
    void questions;
  };

  const handleSubmitPostTest = () => {
    const answeredMcqCount = Object.keys(state.postTestMcqAnswers).length;
    if (answeredMcqCount < 6 || !state.postTestWritten7.trim()) {
      alert('กรุณาทำข้อสอบข้อ 1–6 และเขียนข้อความในข้อ 7 ให้ครบทุกข้อก่อนส่งแบบวัดหลังเรียนครับ');
      return;
    }
    const res = calculateSJTScore(assignedPostForm, state.postTestMcqAnswers, state.postTestWritten7);
    updateState({
      postTestDone: true,
      postTestScores: { total: res.total, obj1: res.obj1, obj2: res.obj2, obj3: res.obj3 }
    });
    SoundService.playSuccess();
  };

  // Handler for Step 4.5 Save Draft -> triggers Step 4.6 Injected Event
  const handleSaveStep4Draft = () => {
    if (!state.selectedScenarioCode) {
      alert('กรุณาเลือกสถานการณ์ A, B หรือ C ในขั้น 4.1 ก่อนครับ');
      return;
    }
    if (!state.goalFullText.trim()) {
      alert('กรุณากรอกเป้าหมายในขั้น 4.2 ก่อนบันทึกร่างครับ');
      return;
    }
    if (!isAudienceFilled) {
      alert('กรุณาระบุผู้รับสารหลักและผู้รับสารรองพร้อมสิ่งที่แต่ละกลุ่มต้องรู้ในขั้น 4.3 ครับ');
      return;
    }
    if (!isMessageLinesValid) {
      alert('กรุณาร่างข้อความหลักไม่เกิน 3 บรรทัด (1 ประโยคต่อ 1 บรรทัด) ในขั้น 4.4 ครับ');
      return;
    }
    if (!isChannelsValid) {
      alert('กรุณาเลือกการ์ดช่องทาง 2–3 ใบ และพิมพ์เหตุผลประกอบทุกช่องทางในขั้น 4.5 ครับ');
      return;
    }
    updateState({
      draftSavedAt: new Date().toISOString()
    });
    SoundService.playSuccess();
  };

  // Handler for Step 5.2 Final Submit (locks first submission and opens Model Answer C & D)
  const handleLockAndSubmitWork = () => {
    if (!state.selectedScenarioCode) {
      alert('กรุณาเลือกสถานการณ์ A, B หรือ C และกรอกแผนในขั้นที่ 4 ให้ครบก่อนส่งงานครับ');
      updateState({ currentStage: 'step4' });
      return;
    }
    if (!isGoalFilled || !isAudienceFilled || !isMessageLinesValid || !isChannelsValid || !isInjectedReplyValid) {
      alert('ยังมีข้อมูลในขั้นที่ 4 ไม่ครบตามรูปแบบ (เป้าหมาย, ผู้รับสาร, ข้อความไม่เกิน 3 บรรทัด, ช่องทาง 2–3 ช่องพร้อมเหตุผล หรือคำตอบเหตุการณ์แทรก) กรุณาตรวจสอบให้ครบก่อนส่งงานครับ');
      updateState({ currentStage: 'step4' });
      return;
    }

    const nowIso = new Date().toISOString();
    const locked = state.firstLockedSubmission || {
      scenarioCode: state.selectedScenarioCode,
      goal: state.goalFullText,
      audienceMain: state.audienceMain,
      audienceSub: state.audienceSub,
      keyMessage: state.keyMessage,
      channelsSummary: formattedChannelsText,
      injectedReply: state.injectedReply,
      submittedAt: nowIso,
      autoScores: evalResult.scores,
      autoTotal: evalResult.totalScore
    };

    const combinedReflection = [
      state.reflectionQ1 ? `1) ถ้าย้อนกลับไปขั้นที่ 1 จะตอบต่างไปอย่างไร: ${state.reflectionQ1}` : '',
      state.reflectionQ2 ? `2) เรื่องจริงในโรงเรียนที่จะใช้แผนนี้เป็นเรื่องแรก: ${state.reflectionQ2}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const unitSub: UnitSubmission = {
      unitId: '1.1',
      formData: {
        ...currentFormDataForEval,
        'ความมั่นใจก่อนเรียน_1ถึง5': state.confidenceBefore,
        'ความมั่นใจหลังเรียน_1ถึง5': state.confidenceAfter,
        'คะแนนประเมินตนเอง': state.selfRubricScores,
        'คะแนนแบบวัดก่อนเรียน_เต็ม9': state.preTestScores?.total ?? '-',
        'คะแนนแบบวัดหลังเรียน_เต็ม9': state.postTestScores?.total ?? '-'
      },
      rubricScores: locked.autoScores,
      totalScore: locked.autoTotal,
      reflectionNotes: combinedReflection || 'ส่งงานหน่วย 1.1 เรียบร้อยแล้ว',
      submittedAt: locked.submittedAt
    };

    updateState({
      firstLockedSubmission: locked
    });

    onSubmitUnit(unitSub);
    SoundService.playSuccess();
  };

  // Sync reflection & revised plan to parent submission
  const handleSaveReflectionAndRevision = () => {
    if (!state.firstLockedSubmission) return;
    const combinedReflection = [
      state.reflectionQ1 ? `1) ถ้าย้อนกลับไปขั้นที่ 1 จะตอบต่างไปอย่างไร: ${state.reflectionQ1}` : '',
      state.reflectionQ2 ? `2) เรื่องจริงในโรงเรียนที่จะใช้แผนนี้เป็นเรื่องแรก: ${state.reflectionQ2}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const unitSub: UnitSubmission = {
      unitId: '1.1',
      formData: {
        ...currentFormDataForEval,
        'ฉบับส่งครั้งแรก_ล็อกคะแนน': state.firstLockedSubmission,
        'ความมั่นใจก่อนเรียน_1ถึง5': state.confidenceBefore,
        'ความมั่นใจหลังเรียน_1ถึง5': state.confidenceAfter
      },
      rubricScores: state.firstLockedSubmission.autoScores,
      totalScore: state.firstLockedSubmission.autoTotal,
      reflectionNotes: combinedReflection,
      submittedAt: state.firstLockedSubmission.submittedAt
    };
    onSubmitUnit(unitSub);
    SoundService.playSuccess();
  };

  // Render SJT Quiz (used for both Pre-test and Post-test)
  const renderSJTQuizSection = (mode: 'pre' | 'post') => {
    const formCode: 'A' | 'B' = mode === 'pre' ? state.assignedPreForm : assignedPostForm;
    const questions: SJTQuestion[] = formCode === 'A' ? SJT_FORM_A : SJT_FORM_B;
    const isDone = mode === 'pre' ? state.preTestDone : state.postTestDone;
    const mcqAnswers = mode === 'pre' ? state.preTestMcqAnswers : state.postTestMcqAnswers;
    const written7 = mode === 'pre' ? state.preTestWritten7 : state.postTestWritten7;
    const writtenLines = written7.split(/\r?\n/).filter(l => l.trim()).length;

    const setMcq = (qNum: number, label: 'ก' | 'ข' | 'ค' | 'ง') => {
      if (isDone) return;
      if (mode === 'pre') {
        updateState({ preTestMcqAnswers: { ...state.preTestMcqAnswers, [qNum]: label } });
      } else {
        updateState({ postTestMcqAnswers: { ...state.postTestMcqAnswers, [qNum]: label } });
      }
    };

    const setWritten = (val: string) => {
      if (isDone) return;
      if (mode === 'pre') {
        updateState({ preTestWritten7: val });
      } else {
        updateState({ postTestWritten7: val });
      }
    };

    // Group questions by scenarioTitle
    const scenarioGroups: { title: string; context: string; items: SJTQuestion[] }[] = [];
    for (const q of questions) {
      const last = scenarioGroups[scenarioGroups.length - 1];
      if (!last || last.title !== q.scenarioTitle) {
        scenarioGroups.push({ title: q.scenarioTitle, context: q.scenarioContext, items: [q] });
      } else {
        last.items.push(q);
      }
    }

    return (
      <div className="space-y-6">
        {/* Quiz Header & Instructions */}
        <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-teal-50 border border-indigo-200/80 rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-600 text-white">
                  {mode === 'pre' ? 'ก่อนเริ่ม: แบบวัดก่อนเรียน (8 นาที)' : 'หลังจบ: แบบวัดหลังเรียน (8 นาที)'}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-indigo-800 border border-indigo-200">
                  ฉบับ {formCode === 'A' ? 'ก' : 'ข'} (7 ข้อ · เต็ม 9 คะแนน)
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                แบบวัดสถานการณ์ (Situational Judgment Test) หน่วย 1.1
              </h3>
            </div>

            {mode === 'pre' && !state.preTestDone && (
              <button
                type="button"
                onClick={() => updateState({ assignedPreForm: state.assignedPreForm === 'A' ? 'B' : 'A' })}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer"
                title="ระบบสุ่มสลับฉบับ ก→ข หรือ ข→ก อัตโนมัติ (คลิกเพื่อสลับฉบับทดสอบได้)"
              >
                🔄 สลับลำดับฉบับ (ปัจจุบัน: ก่อนเรียน {state.assignedPreForm === 'A' ? 'ก → หลังเรียน ข' : 'ข → หลังเรียน ก'})
              </button>
            )}
          </div>

          <div className="bg-white/90 border border-indigo-100 rounded-2xl p-4 text-xs sm:text-sm text-slate-700 space-y-1.5">
            <div className="font-extrabold text-indigo-950">คำชี้แจงสำหรับผู้ทำแบบวัด:</div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>แบบวัดนี้มี 7 ข้อ คะแนนเต็ม 9 คะแนน ใช้เวลาประมาณ 8 นาที</li>
              <li>ให้ท่านสมมติว่าเป็นผู้อำนวยการโรงเรียนบ้านตัวอย่าง อ่านข้อมูลโรงเรียนและตารางช่องทางด้านล่างก่อนเริ่มทำ และกลับมาดูได้ตลอดการทำแบบวัด</li>
              <li>ข้อ 1–6 เลือกคำตอบที่เหมาะสมที่สุดเพียงคำตอบเดียว (ข้อละ 1 คะแนน)</li>
              <li>ข้อ 7 เขียนข้อความถึงผู้ปกครองไม่เกิน 3 บรรทัด บรรทัดละ 1 ประโยค ใช้เฉพาะข้อมูลที่มีในสถานการณ์ (0–3 คะแนน)</li>
              <li>ตอบตามความเข้าใจของท่านเอง แบบวัดนี้ไม่นับเป็นคะแนนของหน่วย ใช้ดูพัฒนาการของท่านเท่านั้น</li>
            </ol>
          </div>

          {/* Reference School Table for Quiz */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{QUIZ_SCHOOL_CONTEXT}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-left">
                    <th className="p-2.5 border border-slate-200 font-bold">ช่องทาง</th>
                    <th className="p-2.5 border border-slate-200 font-bold">ความเร็ว</th>
                    <th className="p-2.5 border border-slate-200 font-bold">เข้าถึงใคร</th>
                    <th className="p-2.5 border border-slate-200 font-bold">ข้อจำกัด</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHOOL_CHANNELS_TABLE.filter(c => c.limitationInQuiz).map(ch => (
                    <tr key={ch.id} className="hover:bg-slate-50">
                      <td className="p-2 border border-slate-200 font-bold text-slate-900">{ch.name}</td>
                      <td className="p-2 border border-slate-200 text-slate-700">{ch.speed}</td>
                      <td className="p-2 border border-slate-200 text-slate-700">{ch.reach}</td>
                      <td className="p-2 border border-slate-200 text-slate-600">{ch.limitationInQuiz}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* If Pre-test is completed: per manual, DO NOT show answer key! Show only completion status */}
        {mode === 'pre' && isDone && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold text-emerald-950 text-base sm:text-lg">
                  บันทึกแบบวัดก่อนเรียน (ฉบับ {formCode === 'A' ? 'ก' : 'ข'}) ครบทั้ง 7 ข้อเรียบร้อยแล้ว
                </div>
                <p className="text-xs sm:text-sm text-emerald-800 mt-1">
                  ตามหลักการวัดผล ระบบจะยังไม่แสดงเฉลยในขั้นนี้ และจะเปิดแสดงคะแนนรายจุดประสงค์พร้อมเฉลยละเอียดทั้งสองฉบับหลังจากท่านทำแบบวัดหลังเรียนเสร็จสิ้นครับ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'step1', step1StartedAt: state.step1StartedAt || new Date().toISOString() })}
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shrink-0 flex items-center gap-2 cursor-pointer shadow-md"
            >
              เริ่มขั้นที่ 1: เปิดสถานการณ์ <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Questions List */}
        {(!isDone || mode === 'post') && (
          <div className="space-y-6">
            {scenarioGroups.map((grp, gIdx) => (
              <div key={gIdx} className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-5 shadow-2xs">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider mb-1">
                    {grp.title}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">{grp.context}</p>
                </div>

                <div className="space-y-5">
                  {grp.items.map(q => {
                    const userChoice = mcqAnswers[q.number];
                    return (
                      <div key={q.number} className="space-y-2.5 pt-2 border-t border-slate-100 first:border-none first:pt-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-slate-900 text-sm sm:text-base">{q.questionText}</div>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            จุดประสงค์ที่ {q.objectiveIndex} ({q.maxScore} คะแนน)
                          </span>
                        </div>

                        {q.type === 'mcq' && q.options && (
                          <div className="grid grid-cols-1 gap-2">
                            {q.options.map(opt => {
                              const isSelected = userChoice === opt.label;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  disabled={isDone}
                                  onClick={() => setMcq(q.number, opt.label)}
                                  className={`text-left p-3.5 rounded-2xl border text-xs sm:text-sm transition flex items-start gap-2.5 ${
                                    isSelected
                                      ? 'bg-indigo-50/90 border-indigo-500 text-slate-900 font-bold ring-2 ring-indigo-500/15'
                                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                  } ${isDone ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                  <span
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {opt.label}
                                  </span>
                                  <span className="leading-relaxed">{opt.text}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'written' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>พิมพ์บรรทัดละ 1 ประโยค (สูงสุดไม่เกิน 3 บรรทัด) ใช้เฉพาะข้อมูลในสถานการณ์</span>
                              <span className={`font-bold ${writtenLines > 3 ? 'text-rose-600' : 'text-teal-700'}`}>
                                จำนวนบรรทัดปัจจุบัน: {writtenLines}/3 บรรทัด
                              </span>
                            </div>
                            <textarea
                              rows={3}
                              disabled={isDone}
                              value={written7}
                              onChange={e => setWritten(e.target.value)}
                              placeholder={
                                'บรรทัดที่ 1 (สิ่งที่เปลี่ยนและเหตุผล)...\nบรรทัดที่ 2 (สิ่งที่ผู้ปกครอง/นักเรียนต้องทำ 1)...\nบรรทัดที่ 3 (สิ่งที่ผู้ปกครอง/นักเรียนต้องทำ 2)...'
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {!isDone && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={mode === 'pre' ? handleSubmitPreTest : handleSubmitPostTest}
                  className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {mode === 'pre' ? 'ส่งแบบวัดก่อนเรียน และเข้าสู่ขั้นที่ 1' : 'ส่งแบบวัดหลังเรียน และดูผลพัฒนาการพร้อมเฉลย'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Post-test Results & Full Parallel Answer Key (Both Form A & Form B) */}
        {mode === 'post' && state.postTestDone && (
          <div className="space-y-6 pt-4 border-t border-slate-200">
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-emerald-600" />
                <div>
                  <h4 className="text-lg font-black text-slate-900">
                    สรุปผลพัฒนาการรายจุดประสงค์ (แบบวัดก่อนเรียน vs หลังเรียน)
                  </h4>
                  <p className="text-xs text-slate-600">
                    เปรียบเทียบคะแนนตั้งต้น (ฉบับ {state.assignedPreForm === 'A' ? 'ก' : 'ข'}) กับคะแนนหลังเรียน (ฉบับ {assignedPostForm === 'A' ? 'ก' : 'ข'})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-emerald-200">
                  <div className="text-xs font-bold text-slate-500">คะแนนรวม (เต็ม 9)</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    ก่อน {state.preTestScores?.total ?? 0} → หลัง{' '}
                    <span className="text-emerald-700">{state.postTestScores?.total ?? 0}</span>/9
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <div className="text-xs font-bold text-slate-500">จุดประสงค์ 1: เป้าหมาย/ผู้รับ (ข้อ 1, 4)</div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    ก่อน {state.preTestScores?.obj1 ?? 0}/2 → หลัง{' '}
                    <span className="text-teal-700">{state.postTestScores?.obj1 ?? 0}/2</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <div className="text-xs font-bold text-slate-500">จุดประสงค์ 2: เลือกช่องทาง (ข้อ 2, 5)</div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    ก่อน {state.preTestScores?.obj2 ?? 0}/2 → หลัง{' '}
                    <span className="text-teal-700">{state.postTestScores?.obj2 ?? 0}/2</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200">
                  <div className="text-xs font-bold text-slate-500">จุดประสงค์ 3: เขียนข้อความ/ตอบคำถามใหม่ (ข้อ 3, 6, 7)</div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    ก่อน {state.preTestScores?.obj3 ?? 0}/5 → หลัง{' '}
                    <span className="text-teal-700">{state.postTestScores?.obj3 ?? 0}/5</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Parallel Answer Key Table (Both Form A & Form B as required by manual) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-base">
                เฉลยพร้อมเหตุผลและตัวลวงสะท้อนความเข้าใจผิด (แสดงครบทั้งฉบับ ก และ ฉบับ ข)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-left">
                      <th className="p-2.5 border border-slate-200">ข้อ</th>
                      <th className="p-2.5 border border-slate-200">เฉลย ก</th>
                      <th className="p-2.5 border border-slate-200">เฉลย ข</th>
                      <th className="p-2.5 border border-slate-200">เหตุผล</th>
                      <th className="p-2.5 border border-slate-200">ตัวลวงสะท้อนความเข้าใจผิด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SJT_FORM_A.slice(0, 6).map((qa, idx) => {
                      const qb = SJT_FORM_B[idx];
                      return (
                        <tr key={qa.number} className="align-top">
                          <td className="p-2.5 border border-slate-200 font-extrabold text-slate-900">ข้อ {qa.number}</td>
                          <td className="p-2.5 border border-slate-200 font-bold text-indigo-700">{qa.correctLabel}</td>
                          <td className="p-2.5 border border-slate-200 font-bold text-teal-700">{qb.correctLabel}</td>
                          <td className="p-2.5 border border-slate-200 text-slate-700">{qa.explanation}</td>
                          <td className="p-2.5 border border-slate-200 text-rose-800">{qa.distractorNote}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Criterion for Question 7 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 text-xs space-y-2">
                  <div className="font-extrabold text-indigo-950">คำตอบตัวอย่าง 3 คะแนน ข้อ 7 (ฉบับ ก: เลื่อนกีฬาสี)</div>
                  {SJT_FORM_A[6].writtenCriteria?.sample3Score.map((line, i) => (
                    <div key={i} className="text-slate-700 font-medium">{line}</div>
                  ))}
                </div>
                <div className="bg-teal-50/50 border border-teal-200 rounded-2xl p-4 text-xs space-y-2">
                  <div className="font-extrabold text-teal-950">คำตอบตัวอย่าง 3 คะแนน ข้อ 7 (ฉบับ ข: เลิกเรียนเร็วขึ้น)</div>
                  {SJT_FORM_B[6].writtenCriteria?.sample3Score.map((line, i) => (
                    <div key={i} className="text-slate-700 font-medium">{line}</div>
                  ))}
                </div>
              </div>

              {onNextUnit && (
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={onNextUnit}
                    className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    เข้าสู่หน่วย 1.2: การสร้างเครือข่ายพันธมิตร <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Unit 1.1 Overview Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                MODULE 1 · หน่วย 1.1 (10 คะแนน)
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-600 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> เวลา 61 นาที (กิจกรรม 45 น. + แบบวัดก่อน/หลังเรียนครั้งละ 8 น.)
              </span>
              {state.firstLockedSubmission && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ส่งงานแล้ว (ปลดล็อกหน่วยถัดไป)
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              หน่วย 1.1 การวางแผนในการสื่อสาร
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              <strong>ผลลัพธ์ที่ได้:</strong> แผนสื่อสาร 1 หน้า (ฉบับแก้แล้วเป็น PDF) • คำตอบเหตุการณ์แทรก • บันทึกสะท้อนคิดที่โยงกับโรงเรียนของตนเอง
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setShowSchoolTableModal(!showSchoolTableModal)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs transition cursor-pointer"
            >
              <Info className="w-4 h-4 text-teal-600" />
              {showSchoolTableModal ? 'ซ่อนตารางช่องทางโรงเรียน' : 'เปิดดูข้อมูลโรงเรียน & ตารางช่องทาง'}
            </button>
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" /> พิมพ์แผน / PDF
            </button>
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                แดชบอร์ด
              </button>
            )}
          </div>
        </div>

        {/* Learning Objectives & PDPA Notice */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
          <div className="lg:col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
            <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-600" /> จุดประสงค์การเรียนรู้ (ผู้เรียนสามารถ):
            </div>
            <ol className="list-decimal list-inside text-slate-600 space-y-0.5 pl-1">
              <li>ระบุเป้าหมายและผู้รับสารหลัก–รองของสถานการณ์ได้ (เกณฑ์ 1)</li>
              <li>เลือกช่องทาง 2–3 ช่องจากข้อมูลการเข้าถึง พร้อมเหตุผลได้ (เกณฑ์ 3, 4)</li>
              <li>เขียนข้อความไม่เกิน 3 ประโยคที่ผู้รับนำไปปฏิบัติได้ทันที และตอบข้อมูลใหม่โดยไม่ขัดกับแผนได้ (เกณฑ์ 2, 4)</li>
            </ol>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 text-amber-950 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700" /> การบันทึกข้อมูลตาม PDPA & บันทึกร่างอัตโนมัติ:
            </div>
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              ระบบบันทึกร่างอัตโนมัติ ออกกลางคันแล้วทำต่อได้ ข้อมูลเวลาและจำนวนครั้งที่ลองใช้ติดตามความก้าวหน้าและประเมินแพลตฟอร์มตาม PDPA (คะแนนความมั่นใจใช้ติดตามระหว่างเรียนเท่านั้น)
            </p>
          </div>
        </div>

        {/* Collapsible Global School Info & Channel Table */}
        {showSchoolTableModal && (
          <div className="bg-teal-50/40 border border-teal-200 rounded-2xl p-4 space-y-3 animate-fade-in">
            <div className="text-xs sm:text-sm font-extrabold text-teal-950">
              🏫 ข. ข้อมูลโรงเรียนสมมติและตารางช่องทาง (ใช้ร่วมกันทุกเรื่อง):
            </div>
            <p className="text-xs text-slate-700 font-medium">{SAMPLE_SCHOOL_CONTEXT}</p>
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-left">
                    <th className="p-2.5 border border-slate-200">ช่องทาง</th>
                    <th className="p-2.5 border border-slate-200">ความเร็ว</th>
                    <th className="p-2.5 border border-slate-200">เข้าถึงใคร</th>
                    <th className="p-2.5 border border-slate-200">ข้อจำกัด</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHOOL_CHANNELS_TABLE.map(ch => (
                    <tr key={ch.id} className="hover:bg-slate-50">
                      <td className="p-2 border border-slate-200 font-bold text-slate-900">{ch.name}</td>
                      <td className="p-2 border border-slate-200 text-slate-700">{ch.speed}</td>
                      <td className="p-2 border border-slate-200 text-slate-700">{ch.reach}</td>
                      <td className="p-2 border border-slate-200 text-slate-600">{ch.limitation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7-Stage Stepper Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
          {stagesMeta.map((st, idx) => {
            const isActive = state.currentStage === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => updateState({ currentStage: st.id })}
                className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : st.isDone
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/70'
                    : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      isActive
                        ? 'bg-amber-400 text-slate-900'
                        : st.isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {st.isDone && !isActive ? '✓' : idx === 0 ? 'ก' : idx === 6 ? 'ล' : idx}
                  </span>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {st.time}
                  </span>
                </div>
                <div className="text-[11px] font-extrabold truncate">{st.shortLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          STAGE 0: ก่อนเริ่ม — แบบวัดก่อนเรียน (8 นาที)
      ===================================================================== */}
      {state.currentStage === 'pretest' && renderSJTQuizSection('pre')}

      {/* =====================================================================
          STAGE 1: ขั้นที่ 1 เปิดสถานการณ์ (4 นาที) — ใช้เรื่อง D (ฝึก)
      ===================================================================== */}
      {state.currentStage === 'step1' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                ขั้นที่ 1 จาก 5 · เปิดสถานการณ์ (4 นาที)
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                ขั้นที่ 1: เปิดสถานการณ์ด้วยเรื่อง D (สถานการณ์ฝึก)
              </h3>
              <p className="text-xs text-slate-500">
                สิ่งที่ได้: รู้ความคิดตั้งต้นของตน และเห็นผลของช่องทางที่ไม่ครอบคลุมผู้รับ (ขั้น 1–3 ใช้เรื่อง D เพื่อไม่ให้เห็นคำตอบของเรื่อง A–C ล่วงหน้า)
              </p>
            </div>
          </div>

          {/* ขั้น 1.1: การ์ดเรื่อง D แสดงเป็นหน้าจอแจ้งเตือนจำลอง พร้อมนาฬิกานับถึง 18.00 น. */}
          <div className="space-y-3">
            <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              ขั้น 1.1 (1 นาที): อ่านการ์ดเรื่อง D บนหน้าจอแจ้งเตือนจำลอง
            </div>
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      แจ้งเตือนด่วนจากสำนักงานเขตพื้นที่การศึกษา
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-white">
                      เรื่อง D (ฝึก): {SCENARIO_D_PRACTICE.shortLine}
                    </div>
                  </div>
                </div>
                <div className="bg-rose-500/20 border border-rose-400/40 rounded-2xl px-3.5 py-2 text-right">
                  <div className="text-[10px] font-bold text-rose-300 uppercase">เส้นตายการแจ้งผู้ปกครอง</div>
                  <div className="text-xs sm:text-sm font-black text-rose-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rose-400" /> ขณะนี้ 13.00 น. → ต้องแจ้งภายใน 18.00 น. (เหลือ 5 ชม.)
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed bg-slate-800/90 p-4 rounded-2xl border border-slate-700">
                {SCENARIO_D_PRACTICE.fullCard}
              </p>

              <div className="text-xs text-slate-300 bg-slate-800/50 rounded-xl p-3 border border-slate-700/70">
                <strong>ข้อมูลบริบทโรงเรียนบ้านตัวอย่าง:</strong> {SAMPLE_SCHOOL_CONTEXT} (มี LINE 46 ครัวเรือน / ไม่มี LINE 12 ครัวเรือน)
              </div>
            </div>
          </div>

          {/* ขั้น 1.2: คำถามแตกแขนง 2 ชั้น (ไม่นับคะแนน) */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                ขั้น 1.2 (2 นาที): ตอบคำถามแตกแขนง (ผู้รับหลักคือใคร → ช่องทางแรกคืออะไร · ไม่นับคะแนน)
              </div>
              {state.branch1FirstChoice && (
                <span className="text-[11px] text-slate-500">
                  บันทึกคำตอบครั้งแรกแล้ว ({state.branch2Attempts} ครั้งที่ลองชั้นที่ 2)
                </span>
              )}
            </div>

            {/* ชั้นที่ 1 */}
            <div className="space-y-2.5">
              <div className="text-xs sm:text-sm font-bold text-slate-800">{STEP1_BRANCHING_DATA.layer1.question}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STEP1_BRANCHING_DATA.layer1.options.map(opt => {
                  const isSelected = state.branch1Choice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        updateState({
                          branch1Choice: opt.id,
                          branch1FirstChoice: state.branch1FirstChoice || opt.id
                        });
                      }}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                        isSelected
                          ? opt.isCorrect
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/20'
                            : 'bg-amber-50 border-amber-400 text-amber-950 ring-2 ring-amber-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="font-extrabold text-sm">{opt.label}</div>
                      {isSelected && (
                        <div className="mt-2 pt-2 border-t border-black/10 text-xs space-y-1">
                          <div><strong>ผลที่ตามมา:</strong> {opt.consequence}</div>
                          <div className="text-slate-600">💡 <strong>ข้อคิด:</strong> {opt.reflection}</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ชั้นที่ 2 (เปิดเมื่อเลือกชั้นที่ 1 แล้ว) */}
            {state.branch1Choice && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs sm:text-sm font-bold text-slate-800">{STEP1_BRANCHING_DATA.layer2.question}</div>
                  <span className="text-[11px] font-semibold text-indigo-700">
                    ลองเลือกดูผลที่ตามมาได้ (ลองใหม่ได้อีก 1 ครั้ง)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STEP1_BRANCHING_DATA.layer2.options.map(opt => {
                    const isSelected = state.branch2Choice === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          updateState({
                            branch2Choice: opt.id,
                            branch2FirstChoice: state.branch2FirstChoice || opt.id,
                            branch2Attempts: state.branch2Attempts + 1
                          });
                        }}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-400/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="font-extrabold text-sm">{opt.label}</div>
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-indigo-200 text-xs space-y-1">
                            <div><strong>ผลที่ตามมา:</strong> {opt.consequence}</div>
                            <div className="text-indigo-800">💡 <strong>ข้อคิด:</strong> {opt.reflection}</div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {state.branch2Attempts >= 1 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs sm:text-sm text-emerald-950">
                    <div className="font-extrabold flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {state.branch2Attempts >= 2 ? 'คำตอบแนะนำ (หลังจากลองครบ 2 ครั้ง):' : 'คำแนะนำเพิ่มเติม (ท่านสามารถลองคลิกตัวเลือกอื่นอีก 1 ครั้งเพื่อเทียบผลลัพธ์ได้):'}
                    </div>
                    <p>{STEP1_BRANCHING_DATA.layer2.recommendedAnswer}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ขั้น 1.3: ให้คะแนนความมั่นใจ 1-5 */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-3">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900">
              ขั้น 1.3 (1 นาที): ให้คะแนนความมั่นใจในการวางแผนสื่อสารของท่านในตอนนี้ (1 = น้อยที่สุด ถึง 5 = มากที่สุด)
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  type="button"
                  onClick={() => updateState({ confidenceBefore: score })}
                  className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm border transition cursor-pointer ${
                    state.confidenceBefore === score
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                  }`}
                >
                  ระดับ {score} {score === 1 ? '(ไม่มั่นใจเลย)' : score === 5 ? '(มั่นใจมาก)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'pretest' })}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> แบบวัดก่อนเรียน
            </button>
            <button
              type="button"
              disabled={!state.branch2Choice || state.confidenceBefore === 0}
              onClick={() => updateState({ currentStage: 'step2' })}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              ถัดไป: ขั้นที่ 2 เรียนรู้เนื้อหาย่อย <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2: ขั้นที่ 2 เรียนรู้เนื้อหาย่อย (7 นาที)
      ===================================================================== */}
      {state.currentStage === 'step2' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                ขั้นที่ 2 จาก 5 · เรียนรู้เนื้อหาย่อย (7 นาที)
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                องค์ประกอบแผน 4 ช่อง และเกณฑ์การเลือกช่องทาง 3 ข้อ
              </h3>
              <p className="text-xs text-slate-500">
                สิ่งที่ได้: อธิบายองค์ประกอบ 4 ช่อง และใช้เกณฑ์เลือกช่องทางกับข้อมูลจริงได้
              </p>
            </div>
            <VoiceNarratorButton
              text="องค์ประกอบแผนสื่อสาร 4 ช่อง ได้แก่ 1 เป้าหมาย ระบุใคร ทำอะไร ภายในเมื่อไร 2 ผู้รับสาร แยกผู้รับหลักและผู้รับรอง 3 ข้อมูลหลัก ไม่เกิน 3 ประโยค และ 4 ช่องทาง เลือก 2 ถึง 3 ช่องทางที่ถึงเร็วพอ ตรงกลุ่ม และตอบกลับได้"
              label="ฟังเสียงสรุปเนื้อหา"
            />
          </div>

          {/* 🎬 คลิปแอนิเมชันสรุปหน่วย 1.1 พร้อมเสียงบรรยาย + ช่องใส่ลิงก์ YouTube */}
          <InteractiveUnitVideoCard unitId="1.1" />

          {/* ขั้น 2.1: อินโฟกราฟิกแตะเปิดทีละช่อง */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                ขั้น 2.1 (3 นาที): แตะเปิดดูอินโฟกราฟิกองค์ประกอบแผน 4 ช่องให้ครบทุกช่อง ({state.openedInfographics.length}/4 ช่อง)
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                กรอบแนวคิด: ดาวรุวรรณ ถวิลการ (2564) & เสาหลัก Communication: Sheninger (2014)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STEP2_INFOGRAPHIC_CARDS.map(card => {
                const isOpened = state.openedInfographics.includes(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      if (!isOpened) {
                        updateState({ openedInfographics: [...state.openedInfographics, card.id] });
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                      isOpened
                        ? 'bg-[#f0f8ff] border-sky-300 text-slate-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:border-sky-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm text-sky-950">{card.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOpened ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isOpened ? '✓ เปิดอ่านแล้ว' : 'แตะเพื่อเปิดอ่าน'}
                      </span>
                    </div>
                    <div className="text-xs text-sky-800 font-semibold">{card.questionHint}</div>
                    {isOpened && (
                      <div className="mt-2.5 pt-2.5 border-t border-sky-200/80 text-xs space-y-1 text-slate-700">
                        <div className="font-bold text-slate-900">{card.summary}</div>
                        <div>{card.detail}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ขั้น 2.2: จับคู่ข้อความ 4 ข้อกับองค์ประกอบ 4 ช่อง */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                  ขั้น 2.2 (2 นาที): จับคู่ข้อความ 4 ข้อกับองค์ประกอบแผน 4 ช่อง (กรณีตัวอย่าง: แจ้งตรวจสุขภาพฟันนักเรียน)
                </div>
                <p className="text-xs text-slate-500">
                  แตะเลือกองค์ประกอบให้ตรงกับข้อความ (ลองใหม่ได้โดยไม่เสียคะแนน · จำนวนครั้งที่ลอง: {state.matchingAttempts})
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {STEP2_MATCHING_ITEMS.map((item, idx) => {
                const chosen = state.matchingAnswers[item.id];
                const fb = matchingFeedback[item.id];
                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                      ข้อ 2.2-{idx + 1}: {item.text}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['เป้าหมาย', 'ผู้รับสาร', 'ข้อมูลหลัก', 'ช่องทาง'].map(slot => {
                        const isSelected = chosen === slot;
                        const isRight = isSelected && slot === item.correctSlot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              const correct = slot === item.correctSlot;
                              updateState({
                                matchingAnswers: { ...state.matchingAnswers, [item.id]: slot },
                                matchingAttempts: state.matchingAttempts + 1
                              });
                              setMatchingFeedback(prev => ({
                                ...prev,
                                [item.id]: {
                                  isCorrect: correct,
                                  message: correct ? item.correctReason : `ยังไม่ตรง (${item.wrongHint}) ลองเลือกใหม่ได้เลยครับ`
                                }
                              }));
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              isSelected
                                ? isRight
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-rose-600 text-white border-rose-600'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                    {fb && (
                      <div
                        className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                          fb.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {fb.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ขั้น 2.3: ตอบคำถาม 2 ข้อโดยใช้ตารางช่องทาง */}
          <div className="bg-indigo-50/40 border border-indigo-200 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900">
              ขั้น 2.3 (2 นาที): ตอบคำถาม 2 ข้อโดยใช้ตารางช่องทาง (เฉลยทันทีพร้อมไฮไลต์แถวในตาราง)
            </div>

            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-left">
                    <th className="p-2 border border-slate-200">ช่องทาง</th>
                    <th className="p-2 border border-slate-200">ความเร็ว</th>
                    <th className="p-2 border border-slate-200">เข้าถึงใคร</th>
                    <th className="p-2 border border-slate-200">ข้อจำกัด</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHOOL_CHANNELS_TABLE.map(ch => {
                    const isHighlighted =
                      (state.channelQuizAnswers['q2_3_1'] && ch.id === 'school_board') ||
                      (state.channelQuizAnswers['q2_3_2'] && ch.id === 'teacher_phone');
                    return (
                      <tr
                        key={ch.id}
                        className={isHighlighted ? 'bg-amber-100/90 font-bold text-slate-900' : 'hover:bg-slate-50'}
                      >
                        <td className="p-2 border border-slate-200 font-bold">{ch.name}</td>
                        <td className="p-2 border border-slate-200">{ch.speed}</td>
                        <td className="p-2 border border-slate-200">{ch.reach}</td>
                        <td className="p-2 border border-slate-200">{ch.limitation}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STEP2_CHANNEL_QUIZ.map(q => {
                const ans = state.channelQuizAnswers[q.id];
                const isCorrect = ans === q.correctLabel;
                return (
                  <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
                    <div className="text-xs sm:text-sm font-bold text-slate-900">{q.question}</div>
                    <div className="space-y-1.5">
                      {q.options.map(opt => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() =>
                            updateState({
                              channelQuizAnswers: { ...state.channelQuizAnswers, [q.id]: opt.label as 'ก' | 'ข' | 'ค' }
                            })
                          }
                          className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            ans === opt.label
                              ? opt.label === q.correctLabel
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {opt.label}) {opt.text}
                        </button>
                      ))}
                    </div>
                    {ans && (
                      <div
                        className={`text-xs p-2.5 rounded-xl font-medium ${
                          isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        <strong>{isCorrect ? '✓ ถูกต้อง:' : `เฉลยคือข้อ ${q.correctLabel}:`}</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'step1' })}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> ย้อนกลับขั้นที่ 1
            </button>
            <button
              type="button"
              disabled={state.openedInfographics.length < 4}
              onClick={() => updateState({ currentStage: 'step3' })}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              title={state.openedInfographics.length < 4 ? 'กรุณาแตะเปิดดูอินโฟกราฟิกในขั้น 2.1 ให้ครบทั้ง 4 ช่องก่อนครับ' : ''}
            >
              ถัดไป: ขั้นที่ 3 ดูตัวอย่าง <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3: ขั้นที่ 3 ดูตัวอย่าง (4 นาที) — ใช้เรื่อง D
      ===================================================================== */}
      {state.currentStage === 'step3' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <span className="text-xs font-extrabold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
              ขั้นที่ 3 จาก 5 · ดูตัวอย่าง (4 นาที)
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
              ดูแผนตัวอย่างเรื่อง D และฝึกหาจุดบกพร่อง
            </h3>
            <p className="text-xs text-slate-500">
              สิ่งที่ได้: แยกแผนที่ดีกับแผนที่ยังไม่ดีได้ก่อนลงมือทำ
            </p>
          </div>

          {/* ขั้น 3.1: ดูแผนตัวอย่างเรื่อง D แล้วแตะจุดอธิบาย 4 จุด */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                ขั้น 3.1 (2 นาที): ดูแผนตัวอย่างเรื่อง D (เลื่อนประชุมผู้ปกครอง) แล้วแตะจุดอธิบายทั้ง 4 จุด ({state.openedHotspots.length}/4 จุด)
              </div>
            </div>

            <div className="space-y-3">
              {STEP3_HOTSPOTS_D.map((hs, i) => {
                const isOpened = state.openedHotspots.includes(hs.id);
                return (
                  <div
                    key={hs.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-lg">
                          ช่องที่ {i + 1}: {hs.field}
                        </span>
                        <span className="text-[11px] text-slate-500">({hs.instruction})</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 whitespace-pre-line pt-1">
                        {hs.exampleText}
                      </p>
                    </div>

                    <div className="md:w-80 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isOpened) {
                            updateState({ openedHotspots: [...state.openedHotspots, hs.id] });
                          }
                        }}
                        className={`w-full p-3 rounded-xl border text-left text-xs transition cursor-pointer ${
                          isOpened
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 font-bold'
                        }`}
                      >
                        {isOpened ? (
                          <div>
                            <span className="font-extrabold text-emerald-800 block mb-0.5">💡 จุดสังเกตสำคัญ:</span>
                            {hs.hotspotExplanation}
                          </div>
                        ) : (
                          <span className="flex items-center justify-between">
                            <span>👆 แตะเพื่อเปิดคำอธิบายจุดที่ {i + 1}</span>
                            <Sparkles className="w-4 h-4 text-amber-600" />
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ขั้น 3.2: หาจุดผิด 2 จุดในแผนที่มีข้อบกพร่อง (ภาคผนวก 3) */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-rose-950">
                  ขั้น 3.2 (2 นาที): หาจุดผิด 2 จุดในแผนที่มีข้อบกพร่อง (เรื่อง D)
                </div>
                <p className="text-xs text-rose-800">
                  แตะเลือกช่องที่มีข้อบกพร่องให้ครบ 2 จุด (พบด้วยตนเองแล้ว: {state.flawsFoundBySelf}/2 จุด)
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateState({ showFlawSolution: true })}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs cursor-pointer"
              >
                ดูเฉลยทั้งหมด
              </button>
            </div>

            <div className="space-y-3">
              {STEP3_FLAWED_PLAN_D.map(item => {
                const isSelected = state.selectedFlawIds.includes(item.id);
                const reveal = isSelected || state.showFlawSolution || state.selectedFlawIds.length >= 2;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!isSelected) {
                        const nextIds = [...state.selectedFlawIds, item.id];
                        const newlyFound = item.isFlawed ? state.flawsFoundBySelf + 1 : state.flawsFoundBySelf;
                        updateState({
                          selectedFlawIds: nextIds,
                          flawsFoundBySelf: Math.min(2, newlyFound)
                        });
                      }
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer ${
                      reveal
                        ? item.isFlawed
                          ? 'bg-rose-100/80 border-rose-400 text-rose-950'
                          : 'bg-white border-emerald-300 text-slate-800'
                        : 'bg-white hover:border-rose-300 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                        ช่อง: {item.field}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {reveal ? (item.isFlawed ? '⚠️ พบจุดบกพร่อง' : '✓ ช่องนี้ถูกต้อง') : 'แตะหากคิดว่าช่องนี้มีจุดผิด'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm whitespace-pre-line font-medium text-slate-900">{item.text}</p>
                    {reveal && (
                      <div
                        className={`mt-2.5 pt-2 border-t text-xs font-bold ${
                          item.isFlawed ? 'border-rose-300 text-rose-900' : 'border-emerald-200 text-emerald-800'
                        }`}
                      >
                        เฉลย: {item.reason}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'step2' })}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> ย้อนกลับขั้นที่ 2
            </button>
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'step4' })}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5"
            >
              ถัดไป: ขั้นที่ 4 ลงมือปฏิบัติ <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 4: ขั้นที่ 4 ลงมือปฏิบัติ (20 นาที) — เลือก A, B หรือ C
      ===================================================================== */}
      {state.currentStage === 'step4' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              ขั้นที่ 4 จาก 5 · ลงมือปฏิบัติ (20 นาที)
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
              สร้างแผนสื่อสาร 1 หน้า และตอบเหตุการณ์แทรก
            </h3>
            <p className="text-xs text-slate-500">
              ระบบตรวจเฉพาะรูปแบบ (ช่องว่าง, จำนวนบรรทัด, จำนวนช่องทาง) ไม่ตัดสินความเหมาะสมแทนผู้เรียน และจะเปิดแนวคำตอบหลังส่งงานในขั้นที่ 5
            </p>
          </div>

          {/* ขั้น 4.1: เลือกเรื่อง A, B หรือ C จากบรรทัดสรุป (ไม่แสดงระดับความยาก) */}
          <div className="space-y-3">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900">
              ขั้น 4.1 (1 นาที): เลือกสถานการณ์ A, B หรือ C จากบรรทัดสรุป แล้วอ่านการ์ดเต็ม
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STEP4_SCENARIOS_ABC.map(sc => {
                const isSelected = state.selectedScenarioCode === sc.code;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => updateState({ selectedScenarioCode: sc.code as 'A' | 'B' | 'C' })}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 text-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        เรื่อง {sc.code}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">{sc.shortLine}</div>
                  </button>
                );
              })}
            </div>

            {/* เมื่อเลือกแล้วจึงเปิดการ์ดเต็ม พร้อมข้อมูลโรงเรียนและตารางช่องทางที่พับเก็บได้ */}
            {activeScenario && (
              <div className="bg-indigo-950 text-white rounded-3xl p-5 space-y-4">
                <div>
                  <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                    การ์ดสถานการณ์เต็ม · เรื่อง {activeScenario.code}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white mt-1 leading-relaxed">
                    {activeScenario.fullCard}
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3.5 border border-white/15">
                  <button
                    type="button"
                    onClick={() => setCollapseStep4SchoolInfo(!collapseStep4SchoolInfo)}
                    className="w-full flex items-center justify-between text-left text-xs font-bold text-amber-300 cursor-pointer"
                  >
                    <span>📊 ข้อมูลโรงเรียนบ้านตัวอย่างและตาราง 7 ช่องทาง (คลิกเพื่อพับเก็บ/กางออก)</span>
                    {collapseStep4SchoolInfo ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  {!collapseStep4SchoolInfo && (
                    <div className="mt-3 space-y-2.5 text-xs text-slate-200">
                      <p>{SAMPLE_SCHOOL_CONTEXT}</p>
                      <div className="overflow-x-auto bg-slate-900/90 rounded-xl border border-slate-700">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-800 text-slate-200 text-left">
                              <th className="p-2 border border-slate-700">ช่องทาง</th>
                              <th className="p-2 border border-slate-700">ความเร็ว</th>
                              <th className="p-2 border border-slate-700">เข้าถึงใคร</th>
                              <th className="p-2 border border-slate-700">ข้อจำกัด</th>
                            </tr>
                          </thead>
                          <tbody>
                            {SCHOOL_CHANNELS_TABLE.map(c => (
                              <tr key={c.id}>
                                <td className="p-2 border border-slate-700 font-bold text-white">{c.name}</td>
                                <td className="p-2 border border-slate-700">{c.speed}</td>
                                <td className="p-2 border border-slate-700 text-emerald-300">{c.reach}</td>
                                <td className="p-2 border border-slate-700 text-amber-200">{c.limitation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ขั้น 4.2: เขียนเป้าหมายในกรอบ “ให้ [ใคร] ทราบ/ทำ [อะไร] ภายใน [เมื่อไร]” */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-extrabold text-slate-900">
                ขั้น 4.2 (3 นาที): เขียนเป้าหมายในกรอบ “ให้ [ใคร] ทราบ/ทำ [อะไร] ภายใน [เมื่อไร]”
              </label>
              <span className={`text-xs font-bold ${isGoalFilled ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isGoalFilled ? '✓ ระบุครบถ้วน' : '⚠️ กรุณาระบุให้ครบทุกช่อง'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1">ให้ [ใคร]:</span>
                <input
                  type="text"
                  value={state.goalWho}
                  onChange={e => {
                    const who = e.target.value;
                    const nextFull = `ให้${who} ${state.goalAction} ภายใน${state.goalWhen}`.trim();
                    trackFieldEdit('goal');
                    updateState({ goalWho: who, goalFullText: nextFull });
                  }}
                  placeholder="เช่น ผู้ปกครองทุกครัวเรือน..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900"
                />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1">ทราบ/ทำ [อะไร]:</span>
                <input
                  type="text"
                  value={state.goalAction}
                  onChange={e => {
                    const act = e.target.value;
                    const nextFull = `ให้${state.goalWho} ${act} ภายใน${state.goalWhen}`.trim();
                    trackFieldEdit('goal');
                    updateState({ goalAction: act, goalFullText: nextFull });
                  }}
                  placeholder="เช่น ทราบว่าวันนี้ปิดเรียนและงดส่งนักเรียน..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900"
                />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1">ภายใน [เมื่อไร]:</span>
                <input
                  type="text"
                  value={state.goalWhen}
                  onChange={e => {
                    const wh = e.target.value;
                    const nextFull = `ให้${state.goalWho} ${state.goalAction} ภายใน${wh}`.trim();
                    trackFieldEdit('goal');
                    updateState({ goalWhen: wh, goalFullText: nextFull });
                  }}
                  placeholder="เช่น ก่อน 07.00 น. วันนี้..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-600 block mb-1">
                ประโยคเป้าหมายฉบับเต็ม (แก้ไขเรียบเรียงเป็น 1 ประโยคได้โดยตรง):
              </span>
              <input
                type="text"
                value={state.goalFullText}
                onChange={e => {
                  trackFieldEdit('goal');
                  updateState({ goalFullText: e.target.value });
                }}
                placeholder="ให้ [ใคร] ทราบ/ทำ [อะไร] ภายใน [เมื่อไร]..."
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900"
              />
            </div>
          </div>

          {/* ขั้น 4.3: เลือกหรือพิมพ์ผู้รับหลักและรอง พร้อมสิ่งที่แต่ละกลุ่มต้องรู้ */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900">
              ขั้น 4.3 (3 นาที): เลือกหรือพิมพ์ผู้รับสารหลักและรอง พร้อมสิ่งที่แต่ละกลุ่มต้องรู้/ทำ
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-slate-500 font-bold py-1">แตะเพื่อแทรกกลุ่มผู้รับสาร:</span>
              {[
                'ผู้ปกครองทุกครัวเรือน',
                'ผู้ปกครองและผู้ดูแลเด็กเล็กในตำบล',
                'ผู้สูงอายุที่ดูแลนักเรียน',
                'ครูประจำชั้นทุกคน',
                'ผู้ปกครองนักเรียนปัจจุบัน'
              ].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    if (!state.audienceMain) {
                      updateState({ audienceMain: `${chip} (ต้องรู้: )` });
                    } else if (!state.audienceSub) {
                      updateState({ audienceSub: `${chip} (ต้องช่วย: )` });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200 font-semibold cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ผู้รับสารหลัก + สิ่งที่ต้องรู้/ทำ:
                </label>
                <input
                  type="text"
                  value={state.audienceMain}
                  onChange={e => {
                    trackFieldEdit('audienceMain');
                    updateState({ audienceMain: e.target.value });
                  }}
                  placeholder="เช่น ผู้ปกครองทุกครัวเรือน (ต้องรู้ว่า...)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ผู้รับสารรอง + สิ่งที่ต้องรู้/ช่วยลงมือ:
                </label>
                <input
                  type="text"
                  value={state.audienceSub}
                  onChange={e => {
                    trackFieldEdit('audienceSub');
                    updateState({ audienceSub: e.target.value });
                  }}
                  placeholder="เช่น ครูประจำชั้น (ต้องช่วยแจ้งบ้านที่ไม่มีไลน์และ...)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* ขั้น 4.4: ร่างข้อความหลัก 1 ประโยคต่อ 1 บรรทัด ไม่เกิน 3 บรรทัด + พรีวิวช่องทาง */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-extrabold text-slate-900">
                ขั้น 4.4 (5 นาที): ร่างข้อความหลัก (1 ประโยคต่อ 1 บรรทัด ไม่เกิน 3 บรรทัด)
              </label>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    keyMessageLineCount >= 1 && keyMessageLineCount <= 3
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  ระบบนับบรรทัด: {keyMessageLineCount}/3 บรรทัด
                </span>
                <span className="text-slate-500">{state.keyMessage.length} ตัวอักษร</span>
              </div>
            </div>

            <textarea
              rows={3}
              value={state.keyMessage}
              onChange={e => {
                trackFieldEdit('keyMessage');
                updateState({ keyMessage: e.target.value });
              }}
              placeholder={
                'บรรทัดที่ 1: บอกสิ่งที่เกิดขึ้น/เปลี่ยนแปลง...\nบรรทัดที่ 2: บอกสิ่งที่ผู้ปกครองต้องปฏิบัติทันที...\nบรรทัดที่ 3: บอกเวลาที่จะแจ้งข้อมูลครั้งต่อไป หรือช่องทางติดต่อ...'
              }
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />

            {keyMessageLineCount > 3 && (
              <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                ⚠️ ข้อความหลักเกิน 3 บรรทัด ({keyMessageLineCount} บรรทัด) กรุณารวมหรือตัดทอนให้ไม่เกิน 3 บรรทัดครับ
              </div>
            )}

            {/* พรีวิวบนหน้าจอจำลอง LINE / ประกาศหอกระจายข่าว / โพสต์เพจ */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" /> พรีวิวข้อความบนหน้าจอจำลองและเทียบข้อจำกัดของช่องทาง:
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('line')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      activePreviewTab === 'line' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    💬 LINE กลุ่มผู้ปกครอง
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('speaker')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      activePreviewTab === 'speaker' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    📢 หอกระจายข่าวหมู่บ้าน
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('fb')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      activePreviewTab === 'fb' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    🌐 เฟซบุ๊กเพจโรงเรียน
                  </button>
                </div>
              </div>

              {activePreviewTab === 'line' && (
                <div className="bg-[#8cabd9] rounded-2xl p-4 text-xs space-y-2">
                  <div className="text-[11px] font-bold text-white/90">LINE กลุ่มผู้ปกครองโรงเรียนบ้านตัวอย่าง (46 ครัวเรือน)</div>
                  <div className="bg-white rounded-2xl p-3.5 max-w-md text-slate-900 whitespace-pre-line shadow-xs">
                    {state.keyMessage.trim() || '(ยังไม่ได้พิมพ์ข้อความหลัก)'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 bg-white/80 rounded-xl px-3 py-1.5 flex items-center justify-between">
                    <span>ข้อจำกัด LINE: ข้อความยาวเกิน ~220 ตัวอักษรมักถูกข้ามบนมือถือ</span>
                    <span className={state.keyMessage.length > 220 ? 'text-rose-700 font-extrabold' : 'text-emerald-800'}>
                      {state.keyMessage.length}/220 ตัวอักษร {state.keyMessage.length > 220 ? '(ยาวเกินไป!)' : '(พอดี)'}
                    </span>
                  </div>
                </div>
              )}

              {activePreviewTab === 'speaker' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-amber-600" /> สคริปต์อ่านออกไมค์หอกระจายข่าวหมู่บ้าน (ผู้ใหญ่บ้านประกาศ)
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-amber-200 text-slate-900 whitespace-pre-line">
                    “ประกาศจากโรงเรียนบ้านตัวอย่าง... {state.keyMessage.trim() || '(ยังไม่ได้พิมพ์ข้อความหลัก)'}”
                  </div>
                  <div className="text-[11px] font-bold text-amber-950 flex items-center justify-between">
                    <span>ข้อจำกัดหอกระจายข่าว: ประกาศได้เฉพาะข้อความสั้น (ควรอ่านจบภายใน 30 วินาที หรือ ~150 ตัวอักษร)</span>
                    <span className={state.keyMessage.length > 160 ? 'text-rose-700 font-extrabold' : 'text-emerald-800'}>
                      เวลาอ่านประมาณ ~{Math.max(5, Math.round(state.keyMessage.length / 5))} วินาที ({state.keyMessage.length}/150 ตัวอักษร)
                    </span>
                  </div>
                </div>
              )}

              {activePreviewTab === 'fb' && (
                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" /> โพสต์เฟซบุ๊กเพจโรงเรียนบ้านตัวอย่าง (ผู้ติดตาม 450 คน)
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200 text-slate-900 whitespace-pre-line">
                    {state.keyMessage.trim() || '(ยังไม่ได้พิมพ์ข้อความหลัก)'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    หมายเหตุ: คนในหมู่บ้านบางส่วนไม่เปิดเพจตอนเช้า และผู้ปกครองอนุบาลใหม่ส่วนใหญ่ไม่ได้ติดตามเพจ
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ขั้น 4.5: เลือกการ์ดช่องทาง 2–3 ใบ พิมพ์เหตุผลใบละ 1 บรรทัด แล้วกด “บันทึกร่าง” */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                  ขั้น 4.5 (4 นาที): เลือกการ์ดช่องทาง 2–3 ใบ และพิมพ์เหตุผลใบละ 1 บรรทัด
                </div>
                <p className="text-xs text-slate-500">
                  เลือกแล้ว: {state.selectedChannels.length} ช่องทาง (ต้องเลือก 2–3 ช่องทาง พร้อมระบุเหตุผลทุกช่อง)
                </p>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  isChannelsValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isChannelsValid
                  ? `✓ เลือก ${state.selectedChannels.length} ช่องทางพร้อมเหตุผลครบ`
                  : '⚠️ ต้องเลือก 2–3 ช่องทางและระบุเหตุผลทุกช่อง'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SCHOOL_CHANNELS_TABLE.map(ch => {
                const selectedIdx = state.selectedChannels.findIndex(c => c.channelId === ch.id);
                const isSelected = selectedIdx !== -1;
                return (
                  <div
                    key={ch.id}
                    className={`p-3.5 rounded-2xl border transition ${
                      isSelected ? 'bg-teal-50/90 border-teal-500 shadow-2xs' : 'bg-white border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        trackFieldEdit('channels');
                        if (isSelected) {
                          updateState({
                            selectedChannels: state.selectedChannels.filter(c => c.channelId !== ch.id)
                          });
                        } else {
                          if (state.selectedChannels.length >= 3) {
                            alert('เลือกได้ไม่เกิน 3 ช่องทางครับ หากต้องการเปลี่ยนช่องทาง กรุณายกเลิกช่องทางเดิมก่อน');
                            return;
                          }
                          updateState({
                            selectedChannels: [...state.selectedChannels, { channelId: ch.id, reason: '' }]
                          });
                        }
                      }}
                      className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">{ch.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          ความเร็ว: {ch.speed} · {ch.reach}
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isSelected ? '✓' : '+'}
                      </span>
                    </button>

                    {isSelected && (
                      <div className="mt-2.5 pt-2.5 border-t border-teal-200">
                        <input
                          type="text"
                          value={state.selectedChannels[selectedIdx].reason}
                          onChange={e => {
                            trackFieldEdit('channels');
                            const next = [...state.selectedChannels];
                            next[selectedIdx] = { ...next[selectedIdx], reason: e.target.value };
                            updateState({ selectedChannels: next });
                          }}
                          placeholder="พิมพ์เหตุผล 1 บรรทัด (อ้างข้อมูลจากตาราง)..."
                          className="w-full bg-white border border-teal-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* สรุปคอลัมน์ “เข้าถึงใคร” ของช่องทางที่เลือก (ข้อเท็จจริงจากตาราง ไม่บอกว่าครบหรือไม่) */}
            {state.selectedChannels.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="font-extrabold text-slate-800">
                  📋 สรุปข้อมูล “เข้าถึงใคร” จากตารางของช่องทางที่ท่านเลือก ({state.selectedChannels.length} ช่องทาง):
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  {state.selectedChannels.map(entry => {
                    const ch = SCHOOL_CHANNELS_TABLE.find(c => c.id === entry.channelId);
                    return (
                      <li key={entry.channelId}>
                        <strong>{ch?.name}:</strong> เข้าถึง <em>“{ch?.reach}”</em> (ข้อจำกัด: {ch?.limitation})
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveStep4Draft}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> บันทึกร่างแผนสื่อสาร (เพื่อเปิดขั้น 4.6 เหตุการณ์แทรก)
              </button>
            </div>
          </div>

          {/* ขั้น 4.6: เหตุการณ์แทรก (ปรากฏหลังบันทึกร่างครั้งแรก) */}
          {state.draftSavedAt && activeScenario?.injectedEvent && (
            <div className="bg-amber-50/90 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-700" />
                  <h4 className="text-sm sm:text-base font-black text-slate-900">
                    ขั้น 4.6 (4 นาที): เหตุการณ์แทรก (ข้อความแชตจำลองหลังบันทึกร่าง)
                  </h4>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  ใช้ประเมินในเกณฑ์ที่ 4
                </span>
              </div>

              <div className="bg-white border border-amber-300 rounded-2xl p-4 shadow-2xs space-y-1">
                <div className="text-[11px] font-bold text-slate-400">ข้อความใหม่ที่ส่งเข้ามา:</div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                  💬 {activeScenario.injectedEvent.incomingMessage}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-800">
                    พิมพ์คำตอบของท่าน (ไม่เกิน 2 ประโยค / ไม่เกิน 2 บรรทัด) และสามารถย้อนขึ้นไปแก้แผนด้านบนได้ถ้าข้อมูลใหม่ทำให้แผนเดิมใช้ไม่ได้:
                  </label>
                  <span className="font-bold text-amber-900">
                    {state.injectedReply.split(/\r?\n/).filter(l => l.trim()).length}/2 บรรทัด
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={state.injectedReply}
                  onChange={e => {
                    trackFieldEdit('injectedReply');
                    updateState({ injectedReply: e.target.value });
                  }}
                  placeholder="พิมพ์ข้อความตอบกลับไม่เกิน 2 ประโยค โดยไม่ขัดกับแผนสื่อสารของท่าน..."
                  className="w-full bg-white border border-amber-300 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'step3' })}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> ย้อนกลับขั้นที่ 3
            </button>
            <button
              type="button"
              disabled={!isInjectedReplyValid}
              onClick={() => updateState({ currentStage: 'step5' })}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              title={!isInjectedReplyValid ? 'กรุณากดบันทึกร่างและตอบเหตุการณ์แทรกในขั้น 4.6 ก่อนไปขั้นที่ 5 ครับ' : ''}
            >
              ถัดไป: ขั้นที่ 5 ตรวจสอบ ส่งงาน สะท้อนคิด <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 5: ขั้นที่ 5 ตรวจสอบ ส่งงาน สะท้อนคิด (10 นาที)
      ===================================================================== */}
      {state.currentStage === 'step5' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <span className="text-xs font-extrabold text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
              ขั้นที่ 5 จาก 5 · ตรวจสอบ ส่งงาน สะท้อนคิด (10 นาที)
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
              ประเมินตนเอง 4 เกณฑ์ · ส่งงาน · เทียบแนวคำตอบ · บันทึก PDF
            </h3>
          </div>

          {/* ขั้น 5.1: ประเมินตนเองทั้ง 4 เกณฑ์ และทำ Checklist คู่กับแผน */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* แผนที่ผู้เรียนร่างไว้ */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
              <div className="font-extrabold text-slate-900 text-sm flex items-center justify-between">
                <span>📄 แผนสื่อสารของท่าน (เรื่อง {state.selectedScenarioCode || '-'})</span>
                {!state.firstLockedSubmission && (
                  <button
                    type="button"
                    onClick={() => updateState({ currentStage: 'step4' })}
                    className="text-xs text-indigo-600 underline font-bold cursor-pointer"
                  >
                    กลับไปแก้ไขในขั้นที่ 4
                  </button>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-500">เป้าหมาย:</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{activePlanForPdf.goal || '-'}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-500">ผู้รับสารหลัก / รอง:</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    หลัก: {activePlanForPdf.audienceMain || '-'} <br />
                    รอง: {activePlanForPdf.audienceSub || '-'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-500">ข้อความหลัก ({keyMessageLineCount} บรรทัด):</div>
                  <div className="font-semibold text-slate-900 whitespace-pre-line mt-0.5">
                    {activePlanForPdf.keyMessage || '-'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-500">ช่องทาง + เหตุผล:</div>
                  <div className="font-semibold text-slate-900 whitespace-pre-line mt-0.5">
                    {activePlanForPdf.channelsSummary || '-'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="font-bold text-amber-800">คำตอบเหตุการณ์แทรก:</div>
                  <div className="font-semibold text-slate-900 whitespace-pre-line mt-0.5">
                    {activePlanForPdf.injectedReply || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* ตารางประเมินตนเอง 4 เกณฑ์ + Checklist 6 ข้อ */}
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                  ขั้น 5.1 (2 นาที): ประเมินตนเองทั้ง 4 เกณฑ์ (เต็ม 10 คะแนน)
                </div>
                <div className="space-y-2.5">
                  {unit.rubric.map(crit => {
                    const currentSelf = state.selfRubricScores[crit.id] ?? crit.high.score;
                    return (
                      <div key={crit.id} className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                        <div className="font-extrabold text-slate-900 flex justify-between">
                          <span>{crit.title} (เต็ม {crit.maxScore})</span>
                          <span className="text-indigo-700">ประเมินตนเอง: {currentSelf}/{crit.maxScore}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: `ระดับสูง (${crit.high.score})`, val: crit.high.score, desc: crit.high.desc },
                            { label: `ระดับกลาง (${crit.medium.score})`, val: crit.medium.score, desc: crit.medium.desc },
                            { label: `ต้องปรับปรุง (${crit.low.score})`, val: crit.low.score, desc: crit.low.desc }
                          ].map(lv => (
                            <button
                              key={lv.label}
                              type="button"
                              onClick={() =>
                                updateState({
                                  selfRubricScores: { ...state.selfRubricScores, [crit.id]: lv.val }
                                })
                              }
                              className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                                currentSelf === lv.val
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              <div className="text-[11px] font-extrabold">{lv.label}</div>
                              <div className="text-[10px] leading-snug mt-0.5 line-clamp-2">{lv.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Checklist 6 ข้อ (ระบบติ๊กข้อที่ตรวจรูปแบบได้ให้อัตโนมัติ) */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-2.5 text-xs">
                <div className="font-extrabold text-slate-900">
                  Checklist ก่อนกดส่งงาน (ข้อที่มี “ระบบตรวจ” ระบบติ๊กให้อัตโนมัติ):
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isGoalFilled ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isGoalFilled ? '☑' : '☐'}
                    </span>
                    <span>เป้าหมายมีครบ ใคร ทำอะไร เมื่อไร <strong>(ระบบตรวจช่องว่าง)</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isMessageLinesValid ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isMessageLinesValid ? '☑' : '☐'}
                    </span>
                    <span>ข้อความหลักไม่เกิน 3 บรรทัด และบอกสิ่งที่ผู้รับต้องทำ <strong>(ระบบนับบรรทัด)</strong></span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.manualChecklist.noUnconfirmedOrPdpa}
                      onChange={e =>
                        updateState({
                          manualChecklist: { ...state.manualChecklist, noUnconfirmedOrPdpa: e.target.checked }
                        })
                      }
                    />
                    <span>ไม่มีข้อมูลที่ยังไม่ยืนยัน หรือข้อมูลส่วนบุคคลและสุขภาพ</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isChannelsValid ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isChannelsValid ? '☑' : '☐'}
                    </span>
                    <span>ช่องทาง 2–3 ช่อง และมีเหตุผลทุกช่อง <strong>(ระบบตรวจ)</strong></span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.manualChecklist.previewChecked}
                      onChange={e =>
                        updateState({
                          manualChecklist: { ...state.manualChecklist, previewChecked: e.target.checked }
                        })
                      }
                    />
                    <span>ดูพรีวิวแล้ว ข้อความไม่ยาวเกินข้อจำกัดของช่องทาง และตรงกันทุกช่องทาง</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.manualChecklist.injectedAnsweredConsistent}
                      onChange={e =>
                        updateState({
                          manualChecklist: { ...state.manualChecklist, injectedAnsweredConsistent: e.target.checked }
                        })
                      }
                    />
                    <span>ตอบเหตุการณ์แทรกแล้ว และไม่ขัดกับแผน</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ขั้น 5.2: กดส่งงาน (ล็อกฉบับที่ใช้ให้คะแนน และแสดงหัวข้อ ค. และ ง. หลังส่งเท่านั้น) */}
          {!state.firstLockedSubmission ? (
            <div className="bg-gradient-to-r from-indigo-600 to-teal-600 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="font-black text-base sm:text-lg">
                  ขั้น 5.2 (2 นาที): กดส่งงานเพื่อบันทึกคะแนนฉบับส่งครั้งแรก และเปิดดูแนวคำตอบ
                </div>
                <p className="text-xs text-indigo-100 mt-0.5">
                  เมื่อกดส่งงาน ระบบจะเปิดหน่วยถัดไปทันที และแสดง “จุดที่ต้องจับให้ได้ + ตัวอย่างแผนของเรื่องที่เลือก” เพื่อให้ท่านเปรียบเทียบและปรับปรุงแผนก่อนดาวน์โหลด PDF
                </p>
              </div>
              <button
                type="button"
                onClick={handleLockAndSubmitWork}
                className="px-6 py-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-extrabold text-xs sm:text-sm shrink-0 cursor-pointer shadow-lg flex items-center gap-2"
              >
                <Send className="w-4 h-4 text-teal-600" /> กดส่งงานหน่วย 1.1
              </button>
            </div>
          ) : (
            <div className="space-y-6 pt-4 border-t border-slate-200 animate-fade-in">
              {/* แสดงหัวข้อ ค. และ ง. ของเรื่องที่เลือกหลังส่งงานเท่านั้น */}
              {activeScenario && (
                <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                        เปิดแสดงเฉพาะหลังกดส่งงาน (ขั้น 5.2)
                      </span>
                      <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                        เทียบงานของท่านกับ “จุดที่ต้องจับให้ได้” และตัวอย่างแผน เรื่อง {activeScenario.code}
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                      ล็อกฉบับส่งครั้งแรกเมื่อ {new Date(state.firstLockedSubmission.submittedAt).toLocaleTimeString('th-TH')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white rounded-2xl p-4 border border-emerald-200 space-y-2">
                      <div className="font-extrabold text-emerald-900">🎯 ค. จุดที่ต้องจับให้ได้ (เรื่อง {activeScenario.code}):</div>
                      <ul className="space-y-1 text-slate-700">
                        {activeScenario.mustCatchPoints?.map((pt, idx) => (
                          <li key={idx} className="font-medium">{pt.text}</li>
                        ))}
                      </ul>
                      <div className="font-extrabold text-rose-800 pt-2">⚠️ ข้อผิดพลาดแฝงในสถานการณ์:</div>
                      <ul className="list-disc list-inside space-y-1 text-rose-900">
                        {activeScenario.hiddenPitfalls?.map((pf, idx) => (
                          <li key={idx}>{pf}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-emerald-200 space-y-2">
                      <div className="font-extrabold text-indigo-900">✅ ตัวอย่างแผนต้นแบบ เรื่อง {activeScenario.code}:</div>
                      <div><strong>เป้าหมาย:</strong> {activeScenario.modelAnswer?.goal}</div>
                      <div><strong>ผู้รับสารหลัก/รอง:</strong> {activeScenario.modelAnswer?.audience}</div>
                      <div className="whitespace-pre-line"><strong>ข้อความหลัก:</strong> {'\n'}{activeScenario.modelAnswer?.keyMessage}</div>
                      <div className="whitespace-pre-line"><strong>ช่องทาง + เหตุผล:</strong> {'\n'}{activeScenario.modelAnswer?.channelsAndReasons}</div>
                    </div>
                  </div>

                  {/* ตาราง ง. แนวคำตอบเหตุการณ์แทรก */}
                  {activeScenario.injectedEvent && (
                    <div className="bg-white rounded-2xl p-4 border border-amber-200 text-xs space-y-1.5">
                      <div className="font-extrabold text-amber-900">💬 ง. แนวคำตอบเหตุการณ์แทรก (เรื่อง {activeScenario.code}):</div>
                      <div><strong>แนวคำตอบที่ดี:</strong> {activeScenario.injectedEvent.goodResponseGuide}</div>
                      <div className="text-rose-800"><strong>สิ่งที่ควรหลีกเลี่ยง:</strong> {activeScenario.injectedEvent.avoidGuide}</div>
                    </div>
                  )}
                </div>
              )}

              {/* ขั้น 5.3: แก้แผน 1 ครั้ง (ไม่นับคะแนน) แล้วดาวน์โหลด PDF */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                      ขั้น 5.3 (3 นาที): แก้แผนได้ 1 ครั้งเพื่อบันทึกเป็น PDF ฉบับสมบูรณ์ (ไม่นับคะแนนทับฉบับส่งครั้งแรก)
                    </div>
                    <p className="text-xs text-slate-500">
                      PDF จะใช้ฉบับที่แก้แล้ว รวมคำตอบเหตุการณ์แทรก เพื่อเก็บเข้าแฟ้มสะสมงานของผู้บริหาร
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!state.hasRevisedOnce && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPostSubmit(true);
                          if (!state.revisedPlan) {
                            updateState({
                              revisedPlan: {
                                goal: state.goalFullText,
                                audienceMain: state.audienceMain,
                                audienceSub: state.audienceSub,
                                keyMessage: state.keyMessage,
                                channelsSummary: formattedChannelsText,
                                injectedReply: state.injectedReply
                              }
                            });
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
                      >
                        ✏️ แก้ไขแผน 1 ครั้งก่อนโหลด PDF
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPdfModal(true)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-emerald-400" /> ดาวน์โหลด PDF / พิมพ์แผน 1 หน้า
                    </button>
                  </div>
                </div>

                {isEditingPostSubmit && state.revisedPlan && (
                  <div className="bg-white border border-amber-300 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="font-extrabold text-amber-900">แก้ไขแผนสำหรับพิมพ์ใบงาน PDF (แก้ไขได้ 1 ครั้ง):</div>
                    <div>
                      <label className="font-bold block mb-1">เป้าหมาย:</label>
                      <input
                        type="text"
                        value={state.revisedPlan.goal}
                        onChange={e =>
                          updateState({ revisedPlan: { ...state.revisedPlan!, goal: e.target.value } })
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">ข้อความหลัก (ไม่เกิน 3 บรรทัด):</label>
                      <textarea
                        rows={3}
                        value={state.revisedPlan.keyMessage}
                        onChange={e =>
                          updateState({ revisedPlan: { ...state.revisedPlan!, keyMessage: e.target.value } })
                        }
                        className="w-full border border-slate-200 rounded-xl p-3"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">ช่องทางและเหตุผล:</label>
                      <textarea
                        rows={3}
                        value={state.revisedPlan.channelsSummary}
                        onChange={e =>
                          updateState({ revisedPlan: { ...state.revisedPlan!, channelsSummary: e.target.value } })
                        }
                        className="w-full border border-slate-200 rounded-xl p-3"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">คำตอบเหตุการณ์แทรก:</label>
                      <textarea
                        rows={2}
                        value={state.revisedPlan.injectedReply}
                        onChange={e =>
                          updateState({ revisedPlan: { ...state.revisedPlan!, injectedReply: e.target.value } })
                        }
                        className="w-full border border-slate-200 rounded-xl p-3"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPostSubmit(false);
                          updateState({ hasRevisedOnce: true });
                          handleSaveReflectionAndRevision();
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                      >
                        ✓ บันทึกฉบับแก้ไขสำหรับ PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ขั้น 5.4: สะท้อนคิด 2 ข้อ + ให้คะแนนความมั่นใจหลังเรียน */}
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-3xl p-5 space-y-4">
                <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                  ขั้น 5.4 (3 นาที): สะท้อนคิด 2 ข้อที่โยงกับโรงเรียนของตนเอง และประเมินความมั่นใจหลังเรียน
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      1) “ถ้าย้อนกลับไปขั้นที่ 1 ท่านจะตอบต่างไปอย่างไร”
                    </label>
                    <textarea
                      rows={2}
                      value={state.reflectionQ1}
                      onChange={e => updateState({ reflectionQ1: e.target.value })}
                      placeholder="เช่น จะไม่ใช้แค่ไลน์กลุ่มเดียว แต่จะวางแผนให้ครูช่วยโทรแจ้งบ้านที่ไม่มีไลน์..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      2) “เรื่องใดในโรงเรียนของท่านที่จะใช้แผนแบบนี้เป็นเรื่องแรก”
                    </label>
                    <textarea
                      rows={2}
                      value={state.reflectionQ2}
                      onChange={e => updateState({ reflectionQ2: e.target.value })}
                      placeholder="ระบุเรื่องจริงในโรงเรียนของท่านที่จะนำแผน 4 ช่องไปใช้..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    ให้คะแนนความมั่นใจในการวางแผนสื่อสารอีกครั้งหลังเรียน (1–5):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map(sc => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => {
                          updateState({ confidenceAfter: sc });
                          setTimeout(handleSaveReflectionAndRevision, 50);
                        }}
                        className={`px-4 py-2 rounded-xl font-extrabold text-xs border cursor-pointer ${
                          state.confidenceAfter === sc
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        ระดับ {sc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => updateState({ currentStage: 'step4' })}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> ย้อนกลับขั้นที่ 4
            </button>
            <button
              type="button"
              disabled={!state.firstLockedSubmission}
              onClick={() => {
                handleSaveReflectionAndRevision();
                updateState({ currentStage: 'posttest' });
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              ไปต่อ: แบบวัดหลังเรียน (8 นาที) <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 6: หลังจบ — แบบวัดหลังเรียน (8 นาที)
      ===================================================================== */}
      {state.currentStage === 'posttest' && renderSJTQuizSection('post')}

      {/* PDF Modal */}
      {showPdfModal && (
        <ArtifactPdfModal
          unit={unit}
          submission={{
            unitId: '1.1',
            formData: currentFormDataForEval,
            rubricScores: state.firstLockedSubmission?.autoScores || evalResult.scores,
            totalScore: state.firstLockedSubmission?.autoTotal || evalResult.totalScore,
            reflectionNotes: [
              state.reflectionQ1 ? `1) ถ้าย้อนกลับไปขั้นที่ 1 ท่านจะตอบต่างไปอย่างไร: ${state.reflectionQ1}` : '',
              state.reflectionQ2 ? `2) เรื่องใดในโรงเรียนของท่านที่จะใช้แผนแบบนี้เป็นเรื่องแรก: ${state.reflectionQ2}` : ''
            ]
              .filter(Boolean)
              .join('\n'),
            submittedAt: state.firstLockedSubmission?.submittedAt || new Date().toISOString()
          }}
          profile={profile}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
};

