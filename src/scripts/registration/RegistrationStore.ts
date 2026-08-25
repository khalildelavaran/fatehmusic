/*
====================================================
File: src/scripts/registration/RegistrationStore.ts

Purpose:
Central state management for the Registration Wizard.

Architecture:
Instrument -> Instructor -> Schedule -> Student -> Review -> Success

Responsibilities:
- Single source of truth for wizard state
- No DOM manipulation
- No filtering/business logic (the Controller reads the real
  data files directly and hands finished selections to the store)
====================================================
*/

export interface RegistrationInstrument {
  id: number | null;
  slug: string | null;
  title: string | null;
  /** matches course.instrument in data/courses.js, e.g. "guitar" */
  type: string | null;
}

export interface RegistrationInstructor {
  id: number | null;
  name: string | null;
  /** True when this instructor was the only option and was picked automatically, not clicked by the student. */
  auto?: boolean;
}

export interface RegistrationSchedule {
  id: number | null;
  weekday: string | null;
  sessionDuration: number | null;
  classroom: string | number | null;
  classMode: string | null;
  /** True when this time slot was the only option and was picked automatically, not clicked by the student. */
  auto?: boolean;
}

export interface RegistrationStudent {
  firstName: string;
  lastName: string;
  nationalCode: string;
  mobile: string;
  age: number | null;
  gender: "male" | "female" | null;
  hasInstrument: "yes" | "no" | null;
  /** Needed only to fill the printed student contract (قرارداد هنرجویی). */
  fatherName: string;
  idIssuePlace: string;
  birthYear: number | null;
  occupation: string;
  address: string;
}

export interface RegistrationSelection {
  instrument: RegistrationInstrument;
  instructor: RegistrationInstructor;
  schedule: RegistrationSchedule;
}

export type RegistrationStep =
  | "welcome"
  | "instrument"
  | "instructor"
  | "schedule"
  | "student"
  | "review"
  | "success";

export interface RegistrationState {
  currentStep: RegistrationStep;
  selection: RegistrationSelection;
  student: RegistrationStudent;
  trackingCode: string | null;
  completed: boolean;
}

const emptyInstrument = (): RegistrationInstrument => ({
  id: null,
  slug: null,
  title: null,
  type: null
});

const emptyInstructor = (): RegistrationInstructor => ({
  id: null,
  name: null,
  auto: false
});

const emptySchedule = (): RegistrationSchedule => ({
  id: null,
  weekday: null,
  sessionDuration: null,
  classroom: null,
  classMode: null,
  auto: false
});

const createInitialState = (): RegistrationState => ({
  currentStep: "welcome",
  selection: {
    instrument: emptyInstrument(),
    instructor: emptyInstructor(),
    schedule: emptySchedule()
  },
  student: {
    firstName: "",
    lastName: "",
    nationalCode: "",
    mobile: "",
    age: null,
    gender: null,
    hasInstrument: null,
    fatherName: "",
    idIssuePlace: "",
    birthYear: null,
    occupation: "",
    address: ""
  },
  trackingCode: null,
  completed: false
});

class RegistrationStore {
  private state: RegistrationState = createInitialState();

  getState(): RegistrationState {
    return this.state;
  }

  setStep(step: RegistrationStep) {
    this.state.currentStep = step;
  }

  selectInstrument(instrument: RegistrationInstrument) {
    this.state.selection.instrument = instrument;
    // Reset everything downstream of this choice
    this.state.selection.instructor = emptyInstructor();
    this.state.selection.schedule = emptySchedule();
  }

  selectInstructor(instructor: RegistrationInstructor) {
    this.state.selection.instructor = instructor;
    this.state.selection.schedule = emptySchedule();
  }

  selectSchedule(schedule: RegistrationSchedule) {
    this.state.selection.schedule = schedule;
  }

  updateStudent(data: Partial<RegistrationStudent>) {
    this.state.student = { ...this.state.student, ...data };
  }

  setTrackingCode(code: string) {
    this.state.trackingCode = code;
  }

  complete() {
    this.state.completed = true;
    this.state.currentStep = "success";
  }

  reset() {
    this.state = createInitialState();
  }
}

export const registrationStore = new RegistrationStore();
