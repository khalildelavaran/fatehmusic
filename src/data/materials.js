/*
====================================================
File:
src/data/materials.js

Purpose:
Student welcome kit and required materials data

Architecture:
- Static data source
- Used by RegistrationRenderer
- No UI logic
- No business logic

Rules:
1. Notebook (music notation) is common for all instructors
2. Books depend on instrument
3. Music stand is optional for all instruments
4. Footrest is optional for selected instruments
5. Images can be added later without changing components

====================================================
*/


export const commonMaterials = {


    notebook: {


        title: "دفتر نت آموزشگاه",

        required: true,

        image: "/images/materials/music-notebook.webp",

        description:

            "دفتر مخصوص یادداشت نت و تمرین‌های کلاس"



    },



    musicStand: {


        title: "پایه نت",

        required: false,

        image: "/images/materials/music-stand.webp",

        description:

            "برای راحتی مطالعه نت و اجرای تمرین‌ها"



    }



};







export const instrumentMaterials = {



    guitar: {


        books: [


            {

                title:

                    "کتاب متد گیتار کلاسیک",

                required:true,

                image:

                    "/images/materials/guitar-book.webp"

            }


        ],


        optional:[


            commonMaterials.musicStand


        ]


    },








    piano: {


        books:[


            {

                title:

                    "کتاب آموزش پیانو",

                required:true,

                image:

                    "/images/materials/piano-book.webp"

            }


        ],


        optional:[


            commonMaterials.musicStand


        ]


    },








    santur:{


        books:[


            {

                title:

                    "کتاب آموزش سنتور",

                required:true,

                image:

                    "/images/materials/santur-book.webp"

            }


        ],



        optional:[


            commonMaterials.musicStand


        ]



    },








    tar:{


        books:[


            {

                title:

                    "کتاب آموزش تار",

                required:true,

                image:

                    "/images/materials/tar-book.webp"

            }


        ],



        optional:[


            commonMaterials.musicStand,


            {

                title:

                    "زیرپایی",

                required:false,

                image:

                    "/images/materials/footrest.webp"

            }


        ]



    },








    setar:{


        books:[


            {

                title:

                    "کتاب آموزش سه تار",

                required:true,

                image:

                    "/images/materials/setar-book.webp"

            }


        ],



        optional:[


            commonMaterials.musicStand

        ]



    },








    tonbak:{


        books:[


            {

                title:

                    "کتاب آموزش تنبک",

                required:true,

                image:

                    "/images/materials/tonbak-book.webp"

            }


        ],



        optional:[


            {

                title:

                    "زیرپایی",

                required:false,

                image:

                    "/images/materials/footrest.webp"

            }


        ]



    }







};







export function getMaterialsByInstrument(

    instrumentId

){



    const data =

        instrumentMaterials[instrumentId]

        ||

        {



            books:[],

            optional:[]

        };





    return {


        required:[

            commonMaterials.notebook,

            ...data.books

                .filter(

                    item => item.required

                )

        ],



        optional:[

            ...data.optional

        ]



    };



}