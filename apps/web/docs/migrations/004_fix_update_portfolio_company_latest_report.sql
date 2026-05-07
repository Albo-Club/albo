-- Fix: trigger function still wrote to last_news / last_news_updated_at
-- Those columns were dropped from portfolio_companies after the news-scraper feature
-- was removed (commit e1b26c1). The orphaned writes made every company_reports
-- INSERT/UPDATE that flipped processing_status to 'completed' fail with
-- "column \"last_news\" of relation \"portfolio_companies\" does not exist",
-- silently rolling back the UPDATE in store-report.ts so reports stayed pending
-- and never appeared in the UI even though the "report ajouté" email was sent.

CREATE OR REPLACE FUNCTION public.update_portfolio_company_latest_report()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_report_date DATE;
    v_current_created_at TIMESTAMPTZ;
BEGIN
    IF NEW.processing_status = 'completed' THEN
        SELECT cr.report_date, cr.created_at
        INTO v_current_report_date, v_current_created_at
        FROM public.portfolio_companies pc
        JOIN public.company_reports cr ON cr.id = pc.latest_report_id
        WHERE pc.id = NEW.company_id;

        IF v_current_report_date IS NULL
           OR NEW.report_date > v_current_report_date
           OR (NEW.report_date = v_current_report_date AND NEW.created_at > v_current_created_at)
        THEN
            UPDATE public.portfolio_companies
            SET latest_report_id = NEW.id,
                latest_metrics   = NEW.metrics,
                updated_at       = NOW()
            WHERE id = NEW.company_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
