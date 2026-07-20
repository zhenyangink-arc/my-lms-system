"use client";
import type { ComponentType, FocusEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, BookOpen, Building2, ClipboardList, Cog, FileText, HelpCircle, History, LayoutDashboard, Library, Megaphone, MessageSquare, PanelsTopLeft, ShieldCheck, UserCircle } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { MEMBERSHIP_TIER_LABELS, type MembershipTier } from "@/lib/student-permissions";
import { normalizeDashboardPathname, scopeDashboardPath } from "@/lib/dashboard-path";

type Props={userName:string;userRole:string;roleLabel?:string;membershipTier:MembershipTier;canAccessAnnouncements:boolean;dashboardBasePath:string};
type Item={label:string;href:string;icon:ComponentType<{size?:number;className?:string}>;announcementOnly?:boolean;teacherVisible?:boolean;requiresStudentSectionAccess?:boolean};
type Group={label:string;items:Item[];adminOnly?:boolean};
const groups:Group[]=[
 {label:"学习成长",items:[
  {label:"成长总览",href:"/dashboard",icon:LayoutDashboard},
  {label:"我的课程",href:"/dashboard/courses",icon:BookOpen,requiresStudentSectionAccess:true},
  {label:"学习进度",href:"/dashboard/progress",icon:BarChart3,requiresStudentSectionAccess:true},
  {label:"作业与考试",href:"/dashboard/assignments",icon:ClipboardList,requiresStudentSectionAccess:true},
  {label:"会话练习",href:"/dashboard/conversation-practice",icon:MessageSquare,requiresStudentSectionAccess:true},
  {label:"成绩管理",href:"/dashboard/grades",icon:Award,requiresStudentSectionAccess:true},
  {label:"学习记录",href:"/dashboard/records",icon:History,requiresStudentSectionAccess:true},
  {label:"资料库",href:"/dashboard/library",icon:Library,requiresStudentSectionAccess:true}]},
 {label:"留学准备",items:[
  {label:"目标大学",href:"/dashboard/universities",icon:Building2,requiresStudentSectionAccess:true},
  {label:"申请材料",href:"/dashboard/documents",icon:FileText,requiresStudentSectionAccess:true},
  {label:"签证准备",href:"/dashboard/visa",icon:ShieldCheck,requiresStudentSectionAccess:true}]},
 {label:"消息与服务",items:[
  {label:"通知公告",href:"/dashboard/announcements",icon:Megaphone,announcementOnly:true},
  {label:"帮助中心",href:"/dashboard/help",icon:HelpCircle},{label:"个人资料",href:"/dashboard/profile",icon:UserCircle},{label:"设置",href:"/dashboard/settings",icon:Cog}]},
 {label:"后台管理",adminOnly:true,items:[{label:"管理中心",href:"/dashboard/admin",icon:PanelsTopLeft,teacherVisible:true}]}
];
const studentMobile:Item[]=[{label:"总览",href:"/dashboard",icon:LayoutDashboard},{label:"课程",href:"/dashboard/courses",icon:BookOpen,requiresStudentSectionAccess:true},{label:"进度",href:"/dashboard/progress",icon:BarChart3,requiresStudentSectionAccess:true},{label:"大学",href:"/dashboard/universities",icon:Building2,requiresStudentSectionAccess:true},{label:"我的",href:"/dashboard/profile",icon:UserCircle}];
const staffMobile:Item[]=[{label:"总览",href:"/dashboard",icon:LayoutDashboard},{label:"课程",href:"/dashboard/courses",icon:BookOpen},{label:"作业",href:"/dashboard/assignments",icon:ClipboardList},{label:"管理",href:"/dashboard/admin",icon:PanelsTopLeft},{label:"我的",href:"/dashboard/profile",icon:UserCircle}];
const adminRole=(role:string)=>["admin","ceo","platform_super_admin","tenant_super_admin","tenant_operator"].includes(role);
const active=(path:string,href:string)=>href==="/dashboard"?path===href:path===href||path.startsWith(`${href}/`);
const roleLabel=(role:string)=>role==="platform_super_admin"?"平台负责人":role==="tenant_super_admin"?"机构负责人":role==="tenant_operator"?"平台副负责人":role==="ceo"?"运营负责人":role==="admin"?"管理员":role==="teacher"?"教师":"学生";

function PermissionLink({item,collapsed=false,mobile=false,pathname,dashboardBasePath}:{item:Item;collapsed?:boolean;mobile?:boolean;pathname:string;dashboardBasePath:string}){const Icon=item.icon;const selected=active(pathname,item.href);return <Link href={scopeDashboardPath(item.href,dashboardBasePath)} title={collapsed?item.label:undefined} data-student-operation={item.requiresStudentSectionAccess?"true":undefined} data-permission={item.requiresStudentSectionAccess?"dashboard_section":undefined} className={mobile?"flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-bold":`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${collapsed?"justify-center":""}`} style={selected?{color:"var(--app-accent-strong)",backgroundColor:"var(--app-accent-soft)",boxShadow:"inset 0 0 0 1px var(--app-accent)"}:{color:"var(--app-muted)"}}><Icon size={mobile?17:18} className="shrink-0" />{!collapsed&&<span className="truncate">{item.label}</span>}</Link>}

export function DashboardSidebar({userName,userRole,roleLabel:customRoleLabel,membershipTier,canAccessAnnouncements,dashboardBasePath}:Props){
 const pathname=normalizeDashboardPathname(usePathname());const[hovered,setHovered]=useState(false);const collapsed=!hovered;const isAdmin=adminRole(userRole);const isTeacher=userRole==="teacher";const isPlatformAudit=userRole==="platform_super_admin";
 const auditLabel=(item:Item):Item=>isPlatformAudit&&item.href==="/dashboard/courses"?{...item,label:"课程前台巡检"}:item;
 const visible=groups.filter(g=>!g.adminOnly||isAdmin||(isTeacher&&g.items.some(i=>i.teacherVisible))).map(g=>({...g,items:g.items.filter(i=>(!g.adminOnly||!isTeacher||isAdmin||i.teacherVisible)&&(!i.announcementOnly||canAccessAnnouncements)).map(auditLabel)}));
 const mobile=(isAdmin||isTeacher?staffMobile:studentMobile).map(auditLabel);
 function blur(e:FocusEvent<HTMLElement>){if(!e.currentTarget.contains(e.relatedTarget))setHovered(false)}
 const displayedRoleLabel=customRoleLabel??roleLabel(userRole);return <><aside onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocus={()=>setHovered(true)} onBlur={blur} className={`app-sidebar relative hidden shrink-0 border-r transition-[width] duration-200 md:sticky md:top-[68px] md:flex md:h-[calc(100vh-68px)] md:self-start md:flex-col ${collapsed?"md:w-[84px]":"md:w-[264px]"}`}><nav className="flex-1 overflow-y-auto px-3 py-5"><div className="space-y-5">{visible.map(g=><div key={g.label}>{!collapsed?<p className="mb-2 px-3 text-xs font-bold tracking-[0.18em] app-muted-text">{g.label}</p>:<div className="mx-3 mb-2 border-t app-divider"/>}<div className="space-y-1">{g.items.map(i=><PermissionLink key={i.href} item={i} collapsed={collapsed} pathname={pathname} dashboardBasePath={dashboardBasePath}/>)}</div></div>)}</div></nav><div className="border-t px-3 py-2 app-divider"><div className={`flex gap-1.5 ${collapsed?"flex-col items-center":"items-center"}`}><Link href={scopeDashboardPath("/dashboard/profile",dashboardBasePath)} title={collapsed?`${userName}（${displayedRoleLabel}）`:undefined} className={`app-soft-card flex min-w-0 items-center rounded-xl border p-1.5 ${collapsed?"justify-center":"flex-1 gap-2"}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white" style={{backgroundColor:"var(--app-secondary)"}}>{userName.trim().slice(0,1)||"学"}</span>{!collapsed&&<span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{userName}</span><span className="block text-[10px] font-bold app-muted-text">{userRole==="student"?MEMBERSHIP_TIER_LABELS[membershipTier]:displayedRoleLabel}</span></span>}</Link><LogoutButton collapsed/></div></div></aside><nav className="app-topbar fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border p-1.5 shadow-lg md:hidden">{mobile.map(i=><PermissionLink key={i.href} item={i} mobile pathname={pathname} dashboardBasePath={dashboardBasePath}/>)}</nav></>;
}
