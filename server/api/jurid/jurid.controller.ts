import {
    Controller,
    Get,
    Param,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

@Controller('api/jurid')
export class JuridController {

    @Get(':value')
    async getJurid(
        @Param('value') value: string,
    ) {

        const jurid = value.slice(-13);
        const environment = value.slice(0, -13);

        try {

            let returnJurDataApi
            if (environment == "staging") {
                const theUrl = "https://auth-dev.tfac.or.th/auth/partner/login";
                const authBResponse = await fetch(theUrl,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "requestID": "6fe87116fcfbb453c2b16e81c804b6383d992be7",
                            "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0IiwiZW1haWwiOiJ0ZXN0MDRAdGZhYy5vci50aCIsImV4cCI6MTY2OTM2MTIyNX0.tRxic4_XpPFqiz3GuyGP3UcseVsge1O5X_4O9JOhJys",
                        },
                        body: JSON.stringify({
                            username: "bizportal@partner.com",
                            password: "Bizportal@2025",
                            applicationKey: "83fcc79949622a111977839b8f6",
                        }),
                    }
                )
                // Authentication ไม่สำเร็จ
                if (!authBResponse.ok) {
                    console.error(
                        'Authentication API Error:',
                        authBResponse.status,
                    );
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Authentication failed',
                        },
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                const resultAuth = await authBResponse.json()
                const { accessToken, expiresIn } = resultAuth.data || {};
                const theApiDataUrl = `https://api-sandbox.tfac.or.th/v1/corporate/corporate/${jurid}`;
                console.log("theApiDataUrl", theApiDataUrl)
                const fetchJsonData = await fetch(theApiDataUrl,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            "authorization": `Bearer ${accessToken}`,
                        },
                    }
                )
                if (!fetchJsonData.ok) {
                    throw new Error(
                        `Auth Server B failed: ${fetchJsonData}  `
                    )
                } else {
                    const resultJsonData = await fetchJsonData.json()
                    returnJurDataApi = resultJsonData;
                }

                //ส่ง JSON กลับไป JavaScript 
                return {
                    success: true,
                    returnJurDataApi,
                };
                ////////////////////////////////////
            } else if (environment == "production") {
                ////////////////////////////////////
                const theUrl = "https://auth.tfac.or.th/auth/partner/login";
                const authBResponse = await fetch(theUrl,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "requestID": "6fe87116fcfbb453c2b16e81c804b6383d992be7",
                            "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0IiwiZW1haWwiOiJ0ZXN0MDRAdGZhYy5vci50aCIsImV4cCI6MTY2OTM2MTIyNX0.tRxic4_XpPFqiz3GuyGP3UcseVsge1O5X_4O9JOhJys",
                        },
                        body: JSON.stringify({
                            username: "bizportal@tfac.or.th",
                            password: "Bizportal@)5I7gV0np(9z",
                            applicationKey: "4c8ad8657436c018a658b63f900f8c7c",
                        }),
                    }
                )
                // Authentication ไม่สำเร็จ
                if (!authBResponse.ok) {
                    console.error(
                        'Authentication API Error:',
                        authBResponse.status,
                    );
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Authentication failed',
                        },
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                const resultAuth = await authBResponse.json()
                const { accessToken, expiresIn } = resultAuth.data || {};
                const theApiDataUrl = `https://api.tfac.or.th/v1/corporate/corporate/${jurid}`;
                console.log("theApiDataUrl", theApiDataUrl)
                const fetchJsonData = await fetch(theApiDataUrl,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            "authorization": `Bearer ${accessToken}`,
                        },
                    }
                )
                if (!fetchJsonData.ok) {
                    throw new Error(
                        `Auth Server B failed: ${fetchJsonData}  `
                    )
                } else {
                    const resultJsonData = await fetchJsonData.json()
                    returnJurDataApi = resultJsonData;
                }

                //ส่ง JSON กลับไป JavaScript 
                return {
                    success: true,
                    returnJurDataApi,
                };





                ////////////////////////////////////
            }
        } catch (error) {

            // HttpException ที่กำหนดไว้ข้างบน
            if (error instanceof HttpException) {
                throw error;
            }

            // Log ฝั่ง Server เท่านั้น
            console.error(
                'POST /api/jurid error:',
                error,
            );

            // ไม่ส่งรายละเอียดภายในออกไป Browser
            throw new HttpException(
                {
                    success: false,
                    message: 'Internal Server Error',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}