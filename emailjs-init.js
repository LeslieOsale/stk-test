(function() {
    // Initialize EmailJS with public key
    emailjs.init("HdvilqGkifQOOqalR");

    // Verify initialization
    console.log('EmailJS Initialization Check:', {
        initialized: typeof emailjs !== 'undefined',
        hasInit: typeof emailjs.init === 'function',
        hasSend: typeof emailjs.send === 'function'
    });

    // Debug wrapper for email sending
    try {
        if (emailjs && typeof emailjs.send === 'function') {
            const __emailjs_send_orig = emailjs.send.bind(emailjs);

            emailjs.send = async function(serviceId, templateId, params) {
                console.log('DEBUG: emailjs.send called', {
                    serviceId,
                    templateId,
                    params: {
                        ...params,
                        email: params.email ? 'HIDDEN' : undefined,
                        to_email: params.to_email ? 'HIDDEN' : undefined
                    }
                });

                // Validate required fields
                if (!params.email) throw new Error('Email address is required');
                if (!serviceId || !templateId) throw new Error('Service ID and Template ID are required');

                try {
                    const result = await __emailjs_send_orig(serviceId, templateId, params);
                    console.log('DEBUG: emailjs.send success', {
                        status: result.status,
                        text: result.text
                    });
                    return result;
                } catch (err) {
                    console.error('DEBUG: emailjs.send error', {
                        name: err.name,
                        message: err.message,
                        status: err.status,
                        text: err.text
                    });
                    throw err;
                }
            };
        }
    } catch (wrapErr) {
        console.error('EmailJS wrapper setup failed:', wrapErr);
    }
})();
