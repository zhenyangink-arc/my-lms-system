/**
 * 个人资料表单的可序列化状态。
 * 单独放在普通模块中，避免 `use server` 文件导出对象导致开发模式加载失败。
 */
export type UpdateProfileState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialUpdateProfileState: UpdateProfileState = {
  status: "idle",
  message: "",
};
