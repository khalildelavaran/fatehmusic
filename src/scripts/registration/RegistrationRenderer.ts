/*
====================================================
File:
src/scripts/registration/RegistrationRenderer.ts

Purpose:
Registration dynamic data renderer

Responsibilities:
- ReviewStep data binding
- SuccessStep data binding
- Welcome Kit rendering

Not responsible for:
- Creating cards
- Rendering instructors
- Rendering schedules
- Business logic
- State management

====================================================
*/


import {

    getMaterialsByInstrument

} from "../../data/materials";





class RegistrationRenderer {






    updateReview(

        data:any

    ){



        const fields = {


            instrument:

                data.selection?.instrument?.title,



            instructor:

                data.selection?.instructor?.name,



            schedule:

                data.selection?.schedule

                ?

                `${

                    data.selection.schedule.weekday || ""

                }

                ${

                    data.selection.schedule.startTime || ""

                }

                -

                ${

                    data.selection.schedule.endTime || ""

                }`

                :

                "-",






            student:

                `${

                    data.student?.firstName || ""

                }

                ${

                    data.student?.lastName || ""

                }`,






            mobile:

                data.student?.mobile,







            age:

                data.student?.age,








            gender:

                this.translateGender(

                    data.student?.gender

                ),








            hasInstrument:

                this.translateInstrumentStatus(

                    data.student?.hasInstrument

                )



        };







        Object.entries(fields)

        .forEach(

            ([key,value])=>{



                const element =

                    document.querySelector(

                        `[data-review="${key}"]`

                    );




                if(element){



                    element.textContent =

                        String(

                            value || "-"

                        );



                }



            }

        );



    }













    private translateGender(

        value:

            "male"

            |

            "female"

            |

            null

    ){



        const map = {



            male:

                "آقا",




            female:

                "خانم"



        };




        return map[value || ""] || "-";



    }












    private translateInstrumentStatus(

        value:

            "yes"

            |

            "no"

            |

            null

    ){



        const map = {



            yes:

                "ساز دارم",




            no:

                "نیاز به مشاوره خرید ساز دارم"



        };




        return map[value || ""] || "-";



    }













    updateSuccess(

        data:any

    ){



        const fields = {



            instrument:

                data.selection?.instrument?.title,





            instructor:

                data.selection?.instructor?.name,





            schedule:

                data.selection?.schedule

                ?

                `${

                    data.selection.schedule.weekday || ""

                }

                ${

                    data.selection.schedule.startTime || ""

                }`

                :

                "-",






            "tracking-code":

                data.trackingCode



        };







        Object.entries(fields)

        .forEach(

            ([key,value])=>{



                const element =

                    document.querySelector(

                        `[data-success="${key}"]`

                    );




                if(element){



                    element.textContent =

                        String(

                            value || "-"

                        );



                }



            }

        );







        const instrumentId =

            data.selection?.instrument?.id;







        if(instrumentId){



            this.renderWelcomeKit(

                instrumentId

            );



        }





    }












    renderWelcomeKit(

        instrumentId:

            string

            |

            number

    ){



        const container =

            document.querySelector(

                "[data-materials-container]"

            );




        if(!container)

            return;







        const materials =

            getMaterialsByInstrument(

                instrumentId

            );








        container.innerHTML = `



            <section class="materials-group">



                <h4>

                    موارد ضروری

                </h4>





                ${

                    materials.required

                    .map(

                        item => `



                        <article class="material-card">





                            ${

                                item.image

                                ?

                                `



                                <img

                                    src="${item.image}"

                                    alt="${item.title}"

                                    loading="lazy"

                                />



                                `

                                :

                                ""

                            }







                            <strong>

                                ${item.title}

                            </strong>





                        </article>



                        `

                    )

                    .join("")

                }



            </section>











            <section class="materials-group">



                <h4>

                    موارد اختیاری

                </h4>







                ${

                    materials.optional

                    .map(

                        item => `





                        <article class="material-card optional">







                            ${

                                item.image

                                ?

                                `



                                <img

                                    src="${item.image}"

                                    alt="${item.title}"

                                    loading="lazy"

                                />



                                `

                                :

                                ""

                            }







                            <strong>

                                ${item.title}

                            </strong>







                            <span>

                                اختیاری

                            </span>







                        </article>





                        `

                    )

                    .join("")

                }



            </section>



        `;



    }







}







export {

    RegistrationRenderer

};