-- ============================================================
-- 扩充韩国重点大学学校库至 100 所
-- 学校身份参考韩国政府 Study in Korea 认证大学名单。
-- sort_order 仅表示本系统展示顺序，不代表官方综合排名。
-- 缺少可靠公开排名的学校保持空值，由管理员复核后在管理中心更新。
-- ============================================================

with university_seed (
  slug, name_zh, name_ko, name_en, ownership, province, city,
  admission_stages, discipline_groups, summary, highlights, sort_order
) as (
  values
    ('sejong-university', '世宗大学', '세종대학교', 'Sejong University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '位于首尔的私立综合大学，在酒店旅游、文化内容、经营与工科方向具有较高辨识度。', array['酒店旅游','文化内容','首尔生活圈'], 370),
    ('soongsil', '崇实大学', '숭실대학교', 'Soongsil University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '位于首尔的私立综合大学，信息技术、经营与社会科学教育具有实践特色。', array['信息技术','经营学','首尔区位'], 380),
    ('kookmin', '国民大学', '국민대학교', 'Kookmin University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '以汽车、设计、经营和文化艺术相关教育见长的首尔私立综合大学。', array['汽车工程','设计艺术','产学合作'], 390),
    ('hongik', '弘益大学', '홍익대학교', 'Hongik University', 'private', '首尔特别市', '首尔／世宗', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '艺术设计辨识度突出，同时覆盖建筑、工科、经营与人文社会学科。', array['艺术设计','建筑学','双校区'], 400),
    ('myongji', '明知大学', '명지대학교', 'Myongji University', 'private', '首尔特别市', '首尔／龙仁', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '拥有首尔与龙仁校区，学科覆盖人文社会、工科、建筑与文化内容方向。', array['双校区','建筑工科','文化内容'], 410),
    ('kwangwoon', '光云大学', '광운대학교', 'Kwangwoon University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '电子信息、软件与智能技术方向特色鲜明的首尔私立大学。', array['电子信息','软件技术','首尔区位'], 420),
    ('sangmyung', '祥明大学', '상명대학교', 'Sangmyung University', 'private', '首尔特别市', '首尔／天安', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '在文化艺术、设计、内容产业和人文教育方面具有特色，设有首尔与天安校区。', array['文化艺术','设计内容','双校区'], 430),
    ('catholic-korea', '韩国天主教大学', '가톨릭대학교', 'The Catholic University of Korea', 'private', '京畿道', '富川／首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '医学、生命科学与人文社会教育兼备，拥有多校区教学和医疗资源。', array['医学资源','生命科学','人文教育'], 440),
    ('hallym', '翰林大学', '한림대학교', 'Hallym University', 'private', '江原特别自治道', '春川', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '位于春川的私立综合大学，医学、生命科学、传媒与国际交流方向较有特色。', array['医学生命','传媒方向','春川生活圈'], 450),
    ('dankook', '檀国大学', '단국대학교', 'Dankook University', 'private', '京畿道', '龙仁／天安', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '龙仁与天安双校区综合大学，覆盖经营、人文、工科、生命科学与医学方向。', array['双校区','综合学科','产学合作'], 460),
    ('kyonggi', '京畿大学', '경기대학교', 'Kyonggi University', 'private', '京畿道', '水原／首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '旅游、酒店、经营与文化内容方向具有特色，设有水原和首尔校区。', array['旅游酒店','经营学','双校区'], 470),
    ('korea-aerospace', '韩国航空大学', '한국항공대학교', 'Korea Aerospace University', 'private', '京畿道', '高阳', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '以航空航天、飞行运航、电子信息和物流管理为核心特色的专业型大学。', array['航空航天','飞行运航','物流管理'], 480),
    ('hankyong-national', '韩京国立大学', '한경국립대학교', 'Hankyong National University', 'national', '京畿道', '安城／平泽', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '京畿道国立大学，实践型工科、农业生命、社会融合和就业支持体系具有特色。', array['国立大学','实践教育','首都圈区位'], 490),
    ('cha-university', '车医科大学', '차의과학대학교', 'CHA University', 'private', '京畿道', '抱川／城南', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['science','natural_sciences','medicine'], '以医学、生命科学、健康产业和临床研究为主要方向的专业型大学。', array['医学健康','生命科学','临床资源'], 500),
    ('eulji', '乙支大学', '을지대학교', 'Eulji University', 'private', '京畿道', '城南／议政府／大田', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['science','natural_sciences','medicine'], '以保健医疗、护理、临床与健康产业人才培养为核心特色。', array['保健医疗','护理学','健康产业'], 510),
    ('duksung-womens', '德成女子大学', '덕성여자대학교', 'Duksung Womens University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '位于首尔的女子综合大学，强调通识教育、国际交流与女性人才成长。', array['女子大学','通识教育','首尔区位'], 520),
    ('dongduk-womens', '同德女子大学', '동덕여자대학교', 'Dongduk Womens University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '文化艺术、设计、传媒与人文社会方向较有特色的首尔女子大学。', array['文化艺术','设计传媒','女子大学'], 530),
    ('sungshin-womens', '诚信女子大学', '성신여자대학교', 'Sungshin Womens University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '学科覆盖人文社会、自然科学、艺术和护理健康方向的首尔女子综合大学。', array['女子大学','护理健康','专业选择广'], 540),
    ('seoul-womens', '首尔女子大学', '서울여자대학교', 'Seoul Womens University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '强调女性领导力、软件融合、设计与人文社会教育的首尔女子大学。', array['女性领导力','软件融合','设计人文'], 550),
    ('hansung', '汉城大学', '한성대학교', 'Hansung University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '以创意融合、设计、信息技术和实践型教育为特色的首尔私立大学。', array['创意融合','设计技术','实践教育'], 560),
    ('sahmyook', '三育大学', '삼육대학교', 'Sahmyook University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '位于首尔东北部，覆盖保健、药学、护理、自然科学与人文社会方向。', array['保健护理','药学方向','首尔校园'], 570),
    ('seokyeong', '西京大学', '서경대학교', 'Seokyeong University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '美容艺术、表演艺术、设计与实践型专业具有较强辨识度。', array['美容艺术','表演设计','实践专业'], 580),
    ('korea-national-sport', '韩国体育大学', '한국체육대학교', 'Korea National Sport University', 'national', '首尔特别市', '首尔', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '韩国国立体育专业大学，覆盖竞技体育、体育科学、健康管理与体育产业。', array['国立体育','竞技训练','体育科学'], 590),
    ('korea-national-arts', '韩国艺术综合学校', '한국예술종합학교', 'Korea National University of Arts', 'national', '首尔特别市', '首尔', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social'], '国立艺术教育机构，专注音乐、戏剧、影视、舞蹈、美术与传统艺术人才培养。', array['国立艺术','影视戏剧','音乐舞蹈'], 600),
    ('busan-foreign-studies', '釜山外国语大学', '부산외국어대학교', 'Busan University of Foreign Studies', 'private', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social'], '外语、区域研究、国际商务与跨文化交流方向特色突出的釜山私立大学。', array['外语教育','区域研究','国际商务'], 610),
    ('dong-a', '东亚大学', '동아대학교', 'Dong-A University', 'private', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '釜山地区大型私立综合大学，覆盖经营、工科、体育、医学与人文社会方向。', array['釜山生活圈','综合学科','医学工科'], 620),
    ('dong-eui', '东义大学', '동의대학교', 'Dong-Eui University', 'private', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '工科、信息技术、经营、韩医与应用型专业较为完整的釜山私立大学。', array['应用工科','信息技术','韩医方向'], 630),
    ('kyungsung', '庆星大学', '경성대학교', 'Kyungsung University', 'private', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '文化内容、传媒、设计、经营与国际教育具有特色，校园位于釜山市区。', array['文化传媒','设计内容','市区校园'], 640),
    ('silla', '新罗大学', '신라대학교', 'Silla University', 'private', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '国际交流、航空服务、旅游、教育与应用工科方向具有特色。', array['航空服务','旅游教育','国际交流'], 650),
    ('kosin', '高神大学', '고신대학교', 'Kosin University', 'private', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','medicine'], '医学、护理、保健与人文教育并重的釜山私立大学。', array['医学护理','保健方向','釜山校区'], 660),
    ('korea-maritime-ocean', '韩国海洋大学', '국립한국해양대학교', 'Korea Maritime and Ocean University', 'national', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '专注海洋、航运、船舶、物流和海事工程的国立专业大学。', array['海洋航运','船舶工程','国立大学'], 670),
    ('ulsan-university', '蔚山大学', '울산대학교', 'University of Ulsan', 'private', '蔚山广域市', '蔚山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '依托蔚山产业环境，在机械、汽车、造船、化工与医学方向具有产学合作优势。', array['产业合作','机械汽车','医学资源'], 680),
    ('keimyung', '启明大学', '계명대학교', 'Keimyung University', 'private', '大邱广域市', '大邱', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '大邱地区私立综合大学，校园规模较大，文化艺术、经营、医学与国际交流资源丰富。', array['国际交流','文化艺术','大邱生活圈'], 690),
    ('daegu-catholic', '大邱天主教大学', '대구가톨릭대학교', 'Daegu Catholic University', 'private', '庆尚北道', '庆山／大邱', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '医学、药学、护理、社会福利与人文教育较为完整的私立综合大学。', array['医学药学','社会福利','综合教育'], 700),
    ('daegu-university', '大邱大学', '대구대학교', 'Daegu University', 'private', '庆尚北道', '庆山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '特殊教育、康复科学、社会福利与应用型专业具有较高辨识度。', array['特殊教育','康复科学','社会福利'], 710),
    ('yeungnam', '岭南大学', '영남대학교', 'Yeungnam University', 'private', '庆尚北道', '庆山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '庆山大型私立综合大学，工科、经营、人文、医学与地区产业联系紧密。', array['综合学科','工科医学','庆山校园'], 720),
    ('kumoh-national-tech', '金乌工科大学', '국립금오공과대학교', 'Kumoh National Institute of Technology', 'national', '庆尚北道', '龟尾', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['science','natural_sciences'], '位于龟尾产业城市的国立工科大学，电子、机械、材料和软件方向突出。', array['国立工科','电子机械','产业区位'], 730),
    ('gyeongkuk-national', '国立庆国大学', '국립경국대학교', 'Gyeongkuk National University', 'national', '庆尚北道', '安东', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '位于安东的国立综合大学，覆盖人文、工程、生命科学与区域文化研究。', array['国立综合','区域文化','工程生命'], 740),
    ('handong-global', '韩东国际大学', '한동대학교', 'Handong Global University', 'private', '庆尚北道', '浦项', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '强调国际化、融合教育、信息技术与创业实践的浦项私立大学。', array['国际化教育','融合课程','创业实践'], 750),
    ('chosun', '朝鲜大学', '조선대학교', 'Chosun University', 'private', '光州广域市', '光州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '光州地区大型私立综合大学，学科覆盖医学、工科、艺术与人文社会。', array['综合学科','医学工科','光州生活圈'], 760),
    ('honam', '湖南大学', '호남대학교', 'Honam University', 'private', '光州广域市', '光州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '汽车、人工智能、旅游服务与文化内容等应用型方向具有特色。', array['汽车人工智能','旅游服务','应用教育'], 770),
    ('kwangju-womens', '光州女子大学', '광주여자대학교', 'Kwangju Womens University', 'private', '光州广域市', '光州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '美容科学、航空服务、护理与社会服务方向较有特色的女子大学。', array['美容科学','航空服务','女子大学'], 780),
    ('daejeon-university', '大田大学', '대전대학교', 'Daejeon University', 'private', '大田广域市', '大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '韩医、保健、信息技术、经营与社会服务专业较为完整。', array['韩医方向','保健科学','信息技术'], 790),
    ('hannam', '韩南大学', '한남대학교', 'Hannam University', 'private', '大田广域市', '大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '人文社会、经营、工科与创业教育兼备的大田私立综合大学。', array['创业教育','经营人文','大田区位'], 800),
    ('woosong', '又松大学', '우송대학교', 'Woosong University', 'private', '大田广域市', '大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '国际化课程、酒店餐饮、铁路物流与信息技术方向具有较强特色。', array['国际课程','酒店餐饮','铁路物流'], 810),
    ('hanbat-national', '韩巴大学', '국립한밭대학교', 'Hanbat National University', 'national', '大田广域市', '大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '以工科、信息技术、产业合作和实践教育为主要特色的国立大学。', array['国立工科','产业合作','实践教育'], 820),
    ('pai-chai', '培材大学', '배재대학교', 'Pai Chai University', 'private', '大田广域市', '大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '外语、国际交流、旅游经营、软件与文化内容方向较为活跃。', array['国际交流','旅游经营','软件内容'], 830),
    ('cheongju', '清州大学', '청주대학교', 'Cheongju University', 'private', '忠清北道', '清州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '航空、设计、传媒、经营与工科等应用型专业具有特色。', array['航空专业','设计传媒','应用工科'], 840),
    ('korea-national-education', '韩国教员大学', '한국교원대학교', 'Korea National University of Education', 'national', '忠清北道', '清州', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '专注教师培养、教育研究和学科教育的国立教育专业大学。', array['国立教育','教师培养','教育研究'], 850),
    ('koreatech', '韩国技术教育大学', '한국기술교육대학교', 'KOREATECH', 'private', '忠清南道', '天安', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '由韩国雇佣劳动部门支持设立，强调工程实践、人力资源开发和职业教育研究。', array['工程实践','职业教育','就业导向'], 860),
    ('soonchunhyang', '顺天乡大学', '순천향대학교', 'Soonchunhyang University', 'private', '忠清南道', '牙山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '医学、生命科学、信息技术与国际交流资源较为完整的私立综合大学。', array['医学资源','生命科学','国际交流'], 870),
    ('sun-moon', '鲜文大学', '선문대학교', 'Sun Moon University', 'private', '忠清南道', '牙山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '国际学生支持、韩语教育、工科和全球商务方向具有较高辨识度。', array['国际学生支持','韩语教育','全球商务'], 880),
    ('hoseo', '湖西大学', '호서대학교', 'Hoseo University', 'private', '忠清南道', '牙山／天安', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '创业教育、工科、设计、文化内容与产业合作方向具有特色。', array['创业教育','产业合作','设计内容'], 890),
    ('konyang', '建阳大学', '건양대학교', 'Konyang University', 'private', '忠清南道', '论山／大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '医学、护理、保健、国防与应用型专业较为突出，设有论山和大田校区。', array['医学保健','国防方向','应用教育'], 900),
    ('jeonju', '全州大学', '전주대학교', 'Jeonju University', 'private', '全北特别自治道', '全州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '旅游餐饮、文化内容、经营与应用型专业具有特色，国际学生支持较活跃。', array['旅游餐饮','文化内容','国际支持'], 910),
    ('wonkwang', '圆光大学', '원광대학교', 'Wonkwang University', 'private', '全北特别自治道', '益山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '医学、韩医、牙医、药学与人文社会教育兼备的私立综合大学。', array['医药学科','韩医牙医','综合教育'], 920),
    ('kunsan-national', '群山大学', '국립군산대학교', 'Kunsan National University', 'national', '全北特别自治道', '群山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '全北沿海地区国立大学，海洋、机械、材料与区域产业方向具有特色。', array['国立大学','海洋产业','机械材料'], 930),
    ('sunchon-national', '顺天大学', '국립순천대학교', 'Sunchon National University', 'national', '全罗南道', '顺天', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '全罗南道国立大学，农业生命、生态环境、工科与区域发展方向较有特色。', array['农业生命','生态环境','国立大学'], 940),
    ('mokpo-maritime', '木浦海洋大学', '국립목포해양대학교', 'Mokpo National Maritime University', 'national', '全罗南道', '木浦', array['bachelor_fresh','bachelor_transfer','master','doctor'], array['science','natural_sciences'], '专注航海、轮机、海洋工程与海事运输的国立专业大学。', array['航海轮机','海洋工程','国立大学'], 950),
    ('inje', '仁济大学', '인제대학교', 'Inje University', 'private', '庆尚南道', '金海／釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '医学、护理、保健、生命科学与工程方向兼备，拥有金海和釜山相关资源。', array['医学保健','生命科学','地区医疗'], 960),
    ('changwon-national', '昌原大学', '국립창원대학교', 'Changwon National University', 'national', '庆尚南道', '昌原', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '昌原产业城市的国立综合大学，机械、材料、智能制造与经营方向联系紧密。', array['国立综合','智能制造','产业区位'], 970),
    ('kyungnam', '庆南大学', '경남대학교', 'Kyungnam University', 'private', '庆尚南道', '昌原', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '经营、人文社会、工科与地区产业相关专业较为完整的昌原私立大学。', array['经营人文','应用工科','昌原区位'], 980),
    ('gangneung-wonju-national', '江陵原州大学', '국립강릉원주대학교', 'Gangneung-Wonju National University', 'national', '江原特别自治道', '江陵／原州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], '江原地区国立综合大学，海洋生命、牙医学、旅游与工科方向具有特色。', array['国立综合','海洋生命','牙医旅游'], 990),
    ('korea-national-transportation', '韩国交通大学', '국립한국교통대학교', 'Korea National University of Transportation', 'national', '忠清北道', '忠州／曾坪／义王', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], '以交通、铁路、航空、物流与工程技术为主要特色的国立大学。', array['交通铁路','航空物流','国立大学'], 1000)
)
insert into public.korean_universities (
  slug, name_zh, name_ko, name_en, ownership, province, city,
  admission_stages, discipline_groups,
  tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny,
  tuition_reference_year,
  qs_rank_display, qs_rank_sort, qs_ranking_year,
  joongang_rank_display, joongang_rank_sort, joongang_ranking_year,
  summary, highlights, official_website, ranking_source_url,
  is_featured, is_published, sort_order
)
select
  slug, name_zh, name_ko, name_en, ownership, province, city,
  admission_stages, discipline_groups,
  case when ownership = 'national' then 3600000 else 6500000 end,
  case when ownership = 'national' then 8000000 else 14000000 end,
  case when ownership = 'national' then 20000 else 35000 end,
  case when ownership = 'national' then 45000 else 78000 end,
  2025,
  null, null, null,
  null, null, null,
  summary, highlights, null, null,
  false, true, sort_order
from university_seed
on conflict (slug) do nothing;

-- 更新查询计划统计，便于学校库按展示顺序快速读取新数据。
analyze public.korean_universities;
