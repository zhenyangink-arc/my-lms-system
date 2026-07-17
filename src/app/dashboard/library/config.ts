export const LIBRARY_CATEGORIES=["language","study","application","visa","career","tools"] as const;
export const LIBRARY_RESOURCE_TYPES=["document","image","spreadsheet","presentation","archive","link"] as const;
export const LIBRARY_STATUSES=["draft","published","archived"] as const;
export type LibraryCategory=(typeof LIBRARY_CATEGORIES)[number];export type LibraryResourceType=(typeof LIBRARY_RESOURCE_TYPES)[number];export type LibraryStatus=(typeof LIBRARY_STATUSES)[number];
export const LIBRARY_CATEGORY_LABELS:Record<LibraryCategory,string>={language:"韩语学习",study:"学习方法",application:"留学申请",visa:"签证材料",career:"升学就业",tools:"实用工具"};
export const LIBRARY_RESOURCE_TYPE_LABELS:Record<LibraryResourceType,string>={document:"文档",image:"图片",spreadsheet:"表格",presentation:"演示文稿",archive:"压缩包",link:"外部链接"};
export const LIBRARY_STATUS_LABELS:Record<LibraryStatus,string>={draft:"草稿",published:"已发布",archived:"已归档"};
export function formatFileSize(value:number|null){if(!value)return"外部链接";if(value<1024)return`${value} 字节`;if(value<1024*1024)return`${(value/1024).toFixed(1)} KB`;return`${(value/1024/1024).toFixed(1)} MB`;}
