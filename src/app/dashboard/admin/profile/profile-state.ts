/**
 * 后台个人信息表单的可序列化状态。
 * 单独放在普通模块中，避免 `use server` 文件导出对象导致加载失败。
 */
export type AdminProfileState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialAdminProfileState: AdminProfileState = {
  status: "idle",
  message: "",
};
