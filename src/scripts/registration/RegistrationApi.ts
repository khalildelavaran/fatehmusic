/*
====================================================
File:
src/scripts/registration/RegistrationApi.ts

Purpose:
Registration communication layer

Architecture:
- No UI logic
- No DOM manipulation
- No validation logic
- Handles future communication with backend/API

Future Responsibilities:
- Submit registration data
- Generate tracking code
- Save student information
- Create contract
- Send SMS notifications
- Connect payment gateway
- Connect CRM

Current Version:
- Mock implementation
- Ready for future backend integration

====================================================
*/


import type {

    RegistrationState

} from "./RegistrationStore";





export interface RegistrationResponse {


    success: boolean;


    trackingCode?: string;


    message: string;


}





class RegistrationApi {



    async submit(

        state: RegistrationState

    ): Promise<RegistrationResponse> {



        /*
        ==========================================
        Temporary Mock API

        Later replace with:

        fetch("/api/registration", {
            method:"POST",
            body:JSON.stringify(state)
        })

        ==========================================
        */



        console.log(

            "Registration Data:",

            state

        );




        await this.delay(

            500

        );




        return {


            success:true,


            trackingCode:

                this.generateTrackingCode(),



            message:

                "ثبت نام با موفقیت انجام شد."



        };



    }









    async getWelcomeKit(

        instrumentId:string | number

    ){



        /*
        ==========================================
        Future:

        Load books and materials
        based on instrument

        Example:

        Guitar:
        - Book
        - Music notebook
        - Footrest(optional)

        Piano:
        - Book
        - Notebook

        ==========================================
        */



        return {


            instrumentId,


            materials:[]


        };


    }









    private generateTrackingCode():string {



        const year =

            new Date()

            .getFullYear();




        const random =

            Math.floor(

                100000 +

                Math.random() *

                900000

            );



        return `FM-${year}-${random}`;



    }









    private delay(

        ms:number

    ){


        return new Promise(

            resolve =>

                setTimeout(

                    resolve,

                    ms

                )

        );


    }





}





export const registrationApi =

    new RegistrationApi();