class ApiResponse {
    constructor(statusCode,data,message){
        this.statusCode=statusCode
        this.data=data
        this.message=message
        this.status=statusCode<400

    }
}
export {ApiResponse}