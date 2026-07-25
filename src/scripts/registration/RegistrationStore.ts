/*
====================================================
File:
src/scripts/registration/RegistrationStore.ts

Purpose:
Central state management for Registration Wizard

Architecture (Frozen Enterprise v1.0)

Course
    ↓
Instructor
    ↓
Schedule
    ↓
Student
    ↓
Review
    ↓
Registration

Responsibilities:
- Single Source of Truth
- No UI logic
- No DOM manipulation
- Shared state across all registration steps

====================================================
*/


export interface RegistrationStudent {

    firstName: string;

    lastName: string;

    mobile: string;

    age: number | null;

    gender: "male" | "female" | null;

    hasInstrument: "yes" | "no" | null;

    parent?: {

        name: string;

        mobile: string;

    };

}


export interface RegistrationSelection {

    course: {

        id: string | number | null;

        slug: string | null;

        title: string | null;

    };

    instructor: {

        id: string | number | null;

        name: string | null;

    };

    schedule: {

        id: string | number | null;

        weekday: string | null;

        startTime: string | null;

        endTime: string | null;

        classroom: string | number | null;

    };

}



export interface RegistrationState {

    currentStep:

        | "welcome"

        | "course"

        | "instructor"

        | "schedule"

        | "student"

        | "review"

        | "success";



    selection: RegistrationSelection;

    student: RegistrationStudent;

    trackingCode: string | null;

    completed: boolean;

}

const initialState: RegistrationState = {

    currentStep: "welcome",

    selection: {

        course: {

            id: null,

            slug: null,

            title: null

        },

        instructor: {

            id: null,

            name: null

        },

        schedule: {

            id: null,

            weekday: null,

            startTime: null,

            endTime: null,

            classroom: null

        }

    },

    student: {

        firstName: "",

        lastName: "",

        mobile: "",

        age: null,

        gender: null,

        hasInstrument: null

    },

    trackingCode: null,

    completed: false

};


class RegistrationStore {

    private state: RegistrationState;

    constructor() {

        this.state = structuredClone(initialState);

    }



    getState(): RegistrationState {

        return this.state;

    }



    setStep(

        step: RegistrationState["currentStep"]

    ) {

        this.state.currentStep = step;

    }



    selectCourse(

    id: string | number,

    slug: string,

    title: string

) {

    this.state.selection.course = {

        id,

        slug,

        title

    };

    // Reset downstream selections

    this.state.selection.instructor = {

        id: null,

        name: null

    };

    this.state.selection.schedule = {

        id: null,

        weekday: null,

        startTime: null,

        endTime: null,

        classroom: null

    };

}


    selectInstructor(

        id: string | number,

        name: string

    ) {

        this.state.selection.instructor = {

            id,

            name

        };



        // Reset schedule

        this.state.selection.schedule = {

            id: null,

            weekday: null,

            startTime: null,

            endTime: null,

            classroom: null

        };

    }



    selectSchedule(data: {

        id: string | number;

        weekday: string;

        startTime?: string;

        endTime?: string;

        classroom?: string | number;

    }) {

        this.state.selection.schedule = {

            id: data.id,

            weekday: data.weekday,

            startTime: data.startTime ?? null,

            endTime: data.endTime ?? null,

            classroom: data.classroom ?? null

        };

    }



    updateStudent(

        data: Partial<RegistrationStudent>

    ) {

        this.state.student = {

            ...this.state.student,

            ...data

        };

    }



    setTrackingCode(

        code: string

    ) {

        this.state.trackingCode = code;

    }



    complete() {

        this.state.completed = true;

        this.state.currentStep = "success";

    }



    reset() {

        this.state = structuredClone(initialState);

    }

}



export const registrationStore = new RegistrationStore();