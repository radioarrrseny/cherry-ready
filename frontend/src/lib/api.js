import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

let _tgId = null;
export const setTgId = (id) => {
  _tgId = id;
  localStorage.setItem("cc_tg_id", id);
};
export const getTgId = () => {
  if (!_tgId) _tgId = localStorage.getItem("cc_tg_id");
  return _tgId;
};

const api = axios.create({ baseURL: API });
api.interceptors.request.use((cfg) => {
  const id = getTgId();
  if (id) cfg.headers["X-TG-ID"] = id;
  return cfg;
});

export default api;
