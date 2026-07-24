/*
====================================================
File:
src/scripts/registration/RegistrationController.ts

Purpose:
Main controller for Registration Wizard

Architecture:
- Controls wizard flow
- Updates RegistrationStore
- Handles user actions
- Triggers validation and API
- No business logic in UI components
- No Renderer responsibility except Review/Success/WelcomeKit

Responsibilities:
- Step navigation
- Instrument selection
- Instructor loading
- Schedule loading
- Student data collection
- Review preparation
- Registration submission

====================================================
*/


import {

    registrationStore

} from "./RegistrationStore";



import {

    RegistrationRenderer

} from "./RegistrationRenderer";



import {

    registrationValidation

} from "./RegistrationValidation";



import {

    registrationApi

} from "./RegistrationApi";



import {

    instructors

} from "../../data/instructors";



import {

    schedules

} from "../../data/schedule";







class RegistrationController {




    private renderer: RegistrationRenderer;





    constructor(){



        this.renderer =

            new RegistrationRenderer();



        this.initialize();



    }








    private initialize(){



        this.bindEvents();



        this.showStep(

            "welcome"

        );



    }









    private bindEvents(){



        document.addEventListener(

            "click",

            (event)=>{



                const element =

                    (

                        event.target as HTMLElement

                    )

                    .closest(

                        "[data-action]"

                    ) as HTMLElement;




                if(!element)

                    return;





                const action =

                    element.dataset.action;





                switch(action){



                    case "start-registration":



                        this.goToStep(

                            "instrument"

                        );



                    break;





                    case "select-instrument":



                        this.selectInstrument(

                            element

                        );



                    break;





                    case "select-instructor":



                        this.selectInstructor(

                            element

                        );



                    break;





                    case "select-schedule":



                        this.selectSchedule(

                            element

                        );



                    break;





                    case "continue-student":



                        this.collectStudent();



                        this.prepareReview();



                        this.goToStep(

                            "review"

                        );



                    break;





                    case "submit-registration":



                        this.submitRegistration();



                    break;



                }



            }

        );



    }









    private selectInstrument(

        element:HTMLElement

    ){



        const id =

            element.dataset.instrumentId;




        if(!id)

            return;





        const title =

            element.dataset.instrumentTitle

            ||

            element.querySelector("h3")

            ?.textContent

            ?.trim()

            ||

            "";





        registrationStore.selectInstrument(

            id,

            title

        );





        this.loadInstructors(

            id

        );





        this.goToStep(

            "instructor"

        );



    }









    private loadInstructors(

        instrumentId:string

    ){



        const container =

            document.querySelector(

                "[data-instructors-container]"

            );





        if(!container)

            return;






        const available =

            instructors.filter(

                instructor =>

                    instructor.active &&

                    instructor.instruments?.includes(

                        Number(instrumentId)

                    )

            );







        if(!available.length){



            container.innerHTML = `


                <div class="registration-card empty-state">


                    <p>

                        استادی برای این ساز موجود نیست.

                    </p>


                </div>


            `;



            return;



        }








        container.innerHTML =



            available.map(

                instructor => `



                <article


                    class="registration-card instructor-card"


                    data-action="select-instructor"


                    data-instructor-id="${instructor.id}"


                    data-instructor-name="${instructor.name}"


                >



                    ${

                        instructor.image

                        ?

                        `

                        <div class="instructor-image">

                            <img

                                src="${instructor.image}"

                                alt="${instructor.name}"

                                loading="lazy"

                            />

                        </div>

                        `

                        :

                        ""

                    }





                    <h3>

                        ${instructor.name}

                    </h3>




                    <p>

                        ${instructor.bio || ""}

                    </p>




                    <span>

                        انتخاب استاد

                    </span>



                </article>


                `

            )

            .join("");



    }









    private selectInstructor(

        element:HTMLElement

    ){



        const id =

            element.dataset.instructorId;





        if(!id)

            return;





        const name =

            element.dataset.instructorName

            ||

            "";






        registrationStore.selectInstructor(

            id,

            name

        );






        this.loadSchedules(

            id

        );





        this.goToStep(

            "schedule"

        );



    }









    private loadSchedules(

        instructorId:string

    ){



        const container =

            document.querySelector(

                "[data-schedules-container]"

            );





        if(!container)

            return;







        const available =

            schedules.filter(

                schedule =>

                    schedule.active &&

                    schedule.instructorId === Number(instructorId)

            );






        if(!available.length){



            container.innerHTML = `


                <div class="registration-card empty-state">


                    <p>

                        زمان آزادی برای این استاد وجود ندارد.

                    </p>


                </div>


            `;



            return;



        }






        container.innerHTML =



            available.map(

                schedule => `



                <article


                    class="registration-card schedule-card"


                    data-action="select-schedule"


                    data-schedule-id="${schedule.id}"


                    data-weekday="${schedule.weekday}"


                    data-start-time="${schedule.startTime || ""}"


                    data-end-time="${schedule.endTime || ""}"


                    data-classroom="${schedule.classroom || ""}"


                >



                    <h3>

                        ${schedule.weekday}

                    </h3>





                    <p>

                        🕒

                        ${schedule.startTime}

                        -

                        ${schedule.endTime}

                    </p>





                    ${

                        schedule.classroom

                        ?

                        `<p>

                            🏫 کلاس ${schedule.classroom}

                        </p>`

                        :

                        ""

                    }





                    <span>

                        انتخاب زمان

                    </span>




                </article>


                `

            )

            .join("");



    }









    private selectSchedule(

        element:HTMLElement

    ){



        const id =

            element.dataset.scheduleId;





        if(!id)

            return;






        registrationStore.selectSchedule({



            id,

            weekday:

                element.dataset.weekday || "",



            startTime:

                element.dataset.startTime || "",



            endTime:

                element.dataset.endTime || "",



            classroom:

                element.dataset.classroom || null



        });







        this.goToStep(

            "student"

        );



    }









    private collectStudent(){



        const student:any = {};






        document

        .querySelectorAll(

            "[data-field]"

        )

        .forEach(

            field=>{



                const input =

                    field as HTMLInputElement;



                const key =

                    input.dataset.field;



                if(!key)

                    return;





                if(

                    input.type === "radio"

                ){



                    if(input.checked)

                        student[key] = input.value;



                    return;

                }






                student[key] = input.value;



            }

        );






        if(student.age){



            student.age =

                Number(

                    student.age

                );



        }






        registrationStore.updateStudent(

            student

        );



    }









    private prepareReview(){



        this.renderer.updateReview(

            registrationStore.getState()

        );



    }









    private async submitRegistration(){



        const state =

            registrationStore.getState();






        const validation =

            registrationValidation.validate(

                state

            );






        if(!validation.valid){



            alert(

                validation.errors.join("\n")

            );



            return;



        }






        const response =

            await registrationApi.submit(

                state

            );







        if(response.success){



            registrationStore.setTrackingCode(

                response.trackingCode || ""

            );





            registrationStore.complete();






            this.renderer.updateSuccess(

                registrationStore.getState()

            );






            this.goToStep(

                "success"

            );



        }



    }









    private goToStep(

        step:any

    ){



        registrationStore.setStep(

            step

        );



        this.showStep(

            step

        );



    }









    private showStep(

        step:string

    ){



        document

        .querySelectorAll(

            "[data-step]"

        )

        .forEach(

            section=>{



                const item =

                    section as HTMLElement;




                item.hidden =

                    item.dataset.step !== step;



            }

        );



    }







}







export {

    RegistrationController

};