-- Production trigger snapshot; generated 2026-09-22.
-- DATA-FREE.

CREATE TRIGGER leave_request_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION update_staff_updated_at();
CREATE TRIGGER leave_type_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION update_staff_updated_at();
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION update_staff_updated_at();
CREATE TRIGGER trg_enqueue_school_database_provisioning AFTER INSERT ON public.schools FOR EACH ROW EXECUTE FUNCTION enqueue_school_database_provisioning();
