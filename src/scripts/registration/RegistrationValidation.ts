/*
====================================================
File:
src/scripts/registration/RegistrationValidation.ts

Purpose:
Registration data validation layer

Architecture:
- No UI logic
- No DOM manipulation
- Receives data from RegistrationStore
- Returns validation result
- RegistrationController decides how to display errors

Responsibilities:
- Validate course selection
- Validate instructor selection
- Validate schedule selection
- Validate student information
- Validate mobile
- Validate age
- Validate gender
- Validate instrument status

====================================================
*/


import type {

    RegistrationState

} from "./RegistrationStore";





export interface ValidationResult {


    valid:boolean;


    errors:string[];


}







class RegistrationValidation {






    validate(

        state:RegistrationState

    ):ValidationResult {



        const errors:string[] = [];







        /*
        ==========================================
        Course Selection
        ==========================================
        */


        if(

            !state.selection.instrument?.id

        ){


            errors.push(

                "لطفاً ساز مورد نظر را انتخاب کنید."

            );


        }







        /*
        ==========================================
        Instructor
        ==========================================
        */


        if(

            !state.selection.instructor?.id

        ){


            errors.push(

                "لطفاً استاد مورد نظر را انتخاب کنید."

            );


        }








        /*
        ==========================================
        Schedule
        ==========================================
        */


        if(

            !state.selection.schedule?.id

        ){


            errors.push(

                "لطفاً زمان کلاس را انتخاب کنید."

            );


        }








        /*
        ==========================================
        Student
        ==========================================
        */


        if(

            !state.student?.firstName?.trim()

        ){


            errors.push(

                "نام هنرجو وارد نشده است."

            );


        }





        if(

            !state.student?.lastName?.trim()

        ){


            errors.push(

                "نام خانوادگی هنرجو وارد نشده است."

            );


        }








        /*
        ==========================================
        Mobile
        ==========================================
        */


        if(

            !this.validateMobile(

                state.student?.mobile || ""

            )

        ){


            errors.push(

                "شماره موبایل صحیح نیست."

            );


        }









        /*
        ==========================================
        Age
        ==========================================
        */


        if(

            !state.student?.age

        ){


            errors.push(

                "سن هنرجو وارد نشده است."

            );


        }

        else if(

            state.student.age < 3

            ||

            state.student.age > 100

        ){


            errors.push(

                "سن وارد شده معتبر نیست."

            );


        }









        /*
        ==========================================
        Gender
        ==========================================
        */


        if(

            !state.student?.gender

        ){


            errors.push(

                "لطفاً جنسیت هنرجو را انتخاب کنید."

            );


        }









        /*
        ==========================================
        Instrument Status
        ==========================================
        */


        if(

            !state.student?.hasInstrument

        ){


            errors.push(

                "لطفاً وضعیت داشتن ساز را مشخص کنید."

            );


        }







        return {


            valid:

                errors.length === 0,


            errors



        };



    }









    private validateMobile(

        mobile:string

    ):boolean {



        const normalized =

            mobile.replace(

                /\D/g,

                ""

            );



        return /^09\d{9}$/.test(

            normalized

        );



    }







}





export const registrationValidation =

    new RegistrationValidation();