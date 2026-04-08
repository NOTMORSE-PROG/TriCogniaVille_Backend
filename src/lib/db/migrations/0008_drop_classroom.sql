-- TriCognia Ville does not have classroom features. The dormant classes /
-- class_students tables are removed as part of the online refactor. Teacher
-- dashboard helpers (`teacherOwnsStudent`, `visibleStudentIds`) have been
-- rewritten to operate on the full student set, since this is a single-org
-- product where every authenticated teacher sees every student.
--
-- Run AFTER deploying the code change so live queries don't reference the
-- dropped tables.

DROP TABLE IF EXISTS class_students;
DROP TABLE IF EXISTS classes;
