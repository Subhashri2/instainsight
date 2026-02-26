export interface ActionCardData {
    id: string;
    type: 'growth' | 'sales' | 'engagement' | 'opportunity' | 'warning';
    title: string;
    priority: 'high' | 'medium' | 'low';
    confidence_score: number;

    trigger: string;

    action: {
        primary: string;
        secondary?: string;
    };

    ready_to_copy: {
        hook: string;
        caption: string;
        cta: string;
    };

    post_time: {
        date: string;
        time: string;
    };

    expected_result: {
        followers_increase?: string;
        engagement_increase?: string;
        sales_increase?: string;
        confidence_level: string;
    };

    meta: {
        difficulty: string;
        estimated_time_to_create: string;
        impact_score: number;
        urgency_score: number;
    };
}
