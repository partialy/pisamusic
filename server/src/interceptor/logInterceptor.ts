import { Request, Response, NextFunction } from "express";
export const logInterceptor = (req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}] [${req.method}] ${req.url}`);
    next();
}