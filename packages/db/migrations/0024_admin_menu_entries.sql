CREATE TABLE "admin_menu_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"page_id" text,
	"permission" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'menu' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" integer DEFAULT 1 NOT NULL,
	"protected" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_menu_type_check" CHECK ("admin_menu_entries"."type" in ('directory','menu','button')),
	CONSTRAINT "admin_menu_flags_check" CHECK ("admin_menu_entries"."visible" in (0,1) and "admin_menu_entries"."protected" in (0,1)),
	CONSTRAINT "admin_menu_parent_check" CHECK ("admin_menu_entries"."parent_id" is null or "admin_menu_entries"."parent_id" <> "admin_menu_entries"."id")
);
--> statement-breakpoint
ALTER TABLE "admin_menu_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_menu_entries" ADD CONSTRAINT "admin_menu_entries_parent_id_admin_menu_entries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."admin_menu_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_menu_parent_order_idx" ON "admin_menu_entries" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_menu_page_unique" ON "admin_menu_entries" USING btree ("page_id");
--> statement-breakpoint
INSERT INTO admin_menu_entries (id,parent_id,title,type,page_id,permission,icon,sort_order,visible,protected) VALUES
('3978c614-0169-4730-8124-8431a017e278',NULL,'系统管理','directory',NULL,'','settings',20,1,1),
('8456a815-de7f-4376-96e4-537f417176c2',NULL,'管理首页','menu','overview','overview','home',10,1,1),
('b3b88e14-8a32-42ce-a2ea-d9e6f222e836','8456a815-de7f-4376-96e4-537f417176c2','导出统计','button',NULL,'overview:export','menu',0,1,0),
('0c9f31cd-6d67-4fef-a224-44254e603758','3978c614-0169-4730-8124-8431a017e278','用户管理','menu','users','users','users',10,1,0),
('6d942f0c-5aa7-4725-92f8-1c61d4ea2d41','0c9f31cd-6d67-4fef-a224-44254e603758','新增','button',NULL,'users:create','menu',0,1,0),
('b3baa1dc-8007-4cdc-a394-be3104070b11','0c9f31cd-6d67-4fef-a224-44254e603758','编辑','button',NULL,'users:edit','menu',10,1,0),
('6bfd7a1b-8502-424f-8e3c-267e7dd7f9a0','0c9f31cd-6d67-4fef-a224-44254e603758','启用 / 停用','button',NULL,'users:status','menu',20,1,0),
('bc227d67-18d4-49a4-92f7-53fee13b59b6','0c9f31cd-6d67-4fef-a224-44254e603758','删除','button',NULL,'users:delete','menu',30,1,0),
('5b663dd7-cf5e-4354-a1bd-d8a2929118b1','3978c614-0169-4730-8124-8431a017e278','角色管理','menu','permissions','permissions','shield',20,1,0),
('648bf32d-eac0-4fa7-b5e6-a0d1b1b72330','5b663dd7-cf5e-4354-a1bd-d8a2929118b1','新增','button',NULL,'permissions:create','menu',0,1,0),
('ea9029b5-ab9c-480a-81d3-3f9b7e5ff1c1','5b663dd7-cf5e-4354-a1bd-d8a2929118b1','编辑','button',NULL,'permissions:edit','menu',10,1,0),
('28530712-5ca0-472a-a29a-9333f9fa457a','5b663dd7-cf5e-4354-a1bd-d8a2929118b1','删除','button',NULL,'permissions:delete','menu',20,1,0),
('911a0df2-dd1e-4e1c-b765-7c77835b2260','3978c614-0169-4730-8124-8431a017e278','菜单管理','menu','menus','menus','menu',30,1,1),
('98392dde-c6ea-4d1e-be9c-150f87ecf3bd','911a0df2-dd1e-4e1c-b765-7c77835b2260','新增','button',NULL,'menus:create','menu',0,1,0),
('25fd9e79-066b-47d3-8d54-c36f0b2fd4dd','911a0df2-dd1e-4e1c-b765-7c77835b2260','编辑','button',NULL,'menus:edit','menu',10,1,0),
('455c1ac8-8165-40a9-91ad-c92c0bd22e94','911a0df2-dd1e-4e1c-b765-7c77835b2260','删除','button',NULL,'menus:delete','menu',20,1,0),
('f08d2473-f507-4a07-baed-5a8a77180892',NULL,'模型服务','menu','model-services','model-services','settings',30,1,0),
('51989d0e-ebd6-44cb-9fb7-7aab6eade89f','f08d2473-f507-4a07-baed-5a8a77180892','保存中转站','button',NULL,'model-services:provider.save','menu',0,1,0),
('49191006-5567-4a6b-a75c-0753401c88f2','f08d2473-f507-4a07-baed-5a8a77180892','保存渠道','button',NULL,'model-services:channel.save','menu',10,1,0),
('19915ca1-c326-4df1-9818-70b2184dea9d','f08d2473-f507-4a07-baed-5a8a77180892','保存默认路由','button',NULL,'model-services:route.save','menu',20,1,0),
('3de8db7a-a43e-4239-bc44-67a2c0532f35','f08d2473-f507-4a07-baed-5a8a77180892','检查连接','button',NULL,'model-services:test','menu',30,1,0),
('02ee92ad-f701-41d7-9455-5945ebf3068f',NULL,'系统状态','menu','system','system','activity',40,1,0),
('e2cc6836-e55f-4ffa-a23b-05bad20e356b','02ee92ad-f701-41d7-9455-5945ebf3068f','刷新状态','button',NULL,'system:refresh','menu',0,1,0);
