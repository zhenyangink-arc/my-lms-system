begin;

-- 两个发现：
-- 1) "owners delete managed profile photos" 策略里写的是 profiles.role = 'super_admin'，
--    这个角色值从来没有真实存在过（当前是 platform_owner 等新角色体系），导致这条策略
--    永远匹配不上任何账号——管理员实际上从来没能通过这条策略删除违规头像，
--    只有用户能删自己的。改成用全站统一的 private.is_platform_owner() 判断。
-- 2) "owners delete managed application documents" 策略引用的 application-documents
--    这个 bucket 在 storage.buckets 里根本不存在（申请材料现在是纯清单状态跟踪，
--    student_application_documents 表也没有文件路径字段），只留了一条指向不存在
--    bucket 的死策略，而且同样卡在 role = 'super_admin' 这个从没生效过的判断上。
--    bucket 都不存在了，直接删掉这条死策略。
drop policy if exists "owners delete managed application documents" on storage.objects;

drop policy if exists "owners delete managed profile photos" on storage.objects;
create policy "owners delete managed profile photos"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (select private.is_platform_owner()));

commit;
