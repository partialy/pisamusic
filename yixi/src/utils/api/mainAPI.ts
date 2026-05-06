import axios from "axios";
import { encrypt } from "../encrypt/index";

let request = axios.create({
  baseURL: "",
  withCredentials: true,
  method: "get",
  timeout: 20000,
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);
const getHomeData = async (baseUrl: string): Promise<any> => {
  return request({
    url: `${baseUrl}/api/pm-desk/init`,
  });
};

const register = async (
  baseUrl: string,
  params: {
    username: string;
    password: string;
    email: string;
  }
) :Promise<{
  code: number;
  msg: string;
  data: {
      username: string,
      avatar: string,
      id:string,
      email:string,
      role: string,
    };
}> => {
  return request({
    url: `${baseUrl}/api/system/register`,
    method: "post",
    data: { enc: encrypt(params) },
  });
}

const login = async (
  baseUrl: string,
  params: {
    username: string;
    password: string;
  }
): Promise<{
  code: number;
  msg: string;
  data: {
    username: string;
    avatar: string;
    role: string;
    email: string;
    id: string;
    token: string;
  };
}> => {
  return request({
    url: `${baseUrl}/api/system/login`,
    method: "post",
    data: { enc: encrypt(params) },
  });
};

export const mainAPI = {
  getHomeData,
  login,
  register,
};
