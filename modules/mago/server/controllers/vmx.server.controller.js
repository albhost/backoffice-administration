'use strict'
const vmx = require('../../../vmx/lib/vmx');

exports.checkVmxAvailability = async function(req, res) {
    /**
     * VMX wont be functional in case:
     *  1 - global package is not create
     *  2 - client failed 
    */

    const pkgName = 'vmx-global-package';
    let client = vmx.getClient(req.token.company_id);

    try {
        await client.getPackage(pkgName);
        res.send({status: true});
    }
    catch(err) {
        let message;
        if (err.response.status == 401) {
            message = 'VMX config is not valid. Pleaase check the provided config.';
        }
        else if (err.response.status == 404) {
            message = "Please enable vmx";
        }
        else {
            message = 'Unknown error';
        }

        res.status(503).send({status: false, message});
    }
}

exports.enableVmx = async function(req, res) {
    try {
        let pkg = {
            id: "vmx-global-package",
            description: 'vmx-global-package'
        }

        let client = vmx.getClient(req.token.company_id);

        await client.upsertPackage(pkg);

        res.send({status: true});
    }
    catch(err) {
        let message;
        if (err.response.status == 401) {
            message = 'VMX config is not valid. Pleaase check the provided config.';
        }
        else {
            message = 'Unknown error';
        }

        res.status(503).send({status: false, message});
    }
}