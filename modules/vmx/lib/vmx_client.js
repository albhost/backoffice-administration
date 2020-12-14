'use strict'

const axios = require('axios');

const UAI_BASE_URL = 'https://uai-v1.vsaas.eu1.verimatrixuatcloud.net';
const SMI_BASE_URL = "https://smi-v1.vsaas.eu1.verimatrixuatcloud.net";

class VmxClient {
    /**
     * Create a vmx client for making requests towards VMX Cloud
     * @param {Object} options VMX cloud config
     * @param {Integer} options.tenantId Tenant id
     * @param {String} options.companyName Operating company name
     * @param {Object} options.auth.username Auth username
     * @param {Object} options.auth.password Auth password
     */
    constructor(options) {
        this.headers = {
            'TENANT_ID': options.tenantId,
            'OPER_COMPANY_NAME': options.companyName
        };

        this.debug = true;
        this.auth = options.auth;
        this.tokenExpire = null;
    }
    

    /**
     * Login using auth
     */
    async login() {
        let url = UAI_BASE_URL + '/uai/v1.0/auth/login';
        let resp = await this.makeRequest({
            method: 'post',
            url: url,
            data: {
                username: this.auth.username,
                password: this.auth.password
            }
        }, true);

        this.refreshAuth(resp.data);

        return resp;
    }

    /**
     * Add or update content
     * @param {Object} content Content
     * @param {String} content.id Id
     * @param {String} content.title Title
     * @param {String} content.contentType Content type
     */
    async upsertContent(content) {
        let url = SMI_BASE_URL + '/smi/v1.0/content/' + content.id;

        delete content.id;
        
        return await this.makeRequest({
            method: 'put',
            url: url,
            data: content
        });
    }

    /**
     * Get content
     * @param {String} id Content id
     */
    async getContent(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/content/' + id;
        
        let result = await this.makeRequest({
            method: 'get',
            url: url
        });

        return result.data;
    }

    /**
     * Delete content
     * @param {String} id Content id
     */
    async deleteContent(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/content/' + id;
        
        return await this.makeRequest({
            method: 'delete',
            url: url
        });
    }

    /**
     * Add or update asset
     * @param {String} contentId Content id
     * @param {Object} asset asset
     * @param {String} asset.id Id
     * @param {String} asset.networkType Network type
     * @param {Object} asset.encryptionSettings Encryption settings. If not provided some default is used
     * @param {String} asset.encryptionSettings.ENCRYPTION_TYPE Encryption type
     * @param {String} asset.encryptionSettings.ENCRYPTION_ALGORITHM Encryption algorithm
     * @param {String} asset.encryptionSettings.SECURITY_LEVEL Security level
     */
    async upsertAsset(contentId, asset) {
        let url = SMI_BASE_URL + '/smi/v1.0/content/' + contentId + '/asset/' + asset.id;

        delete asset.id;
        
        return await this.makeRequest({
            method: 'put',
            url: url,
            data: asset
        });
    }

    /**
     * Get asset
     * @param {String} contentId Content id
     * @param {String} assetId Asset id
     */
    async getAsset(contentId, assetId) {
        let url = SMI_BASE_URL + '/smi/v1.0/content/' + contentId + '/asset/' + assetId;
        
        let result = await this.makeRequest({
            method: 'get',
            url: url
        });

        return result.data;
    }

    /**
     * Delete asset
     * @param {String} contentId Content id
     * @param {String} assetId Asset id
     */
    async deleteAsset(contentId, assetId) {
        let url = SMI_BASE_URL + '/smi/v1.0/content/' + contentId + '/asset/' + assetId;
        
        return await this.makeRequest({
            method: 'delete',
            url: url
        });
    }

    /**
     * Add or update package
     * @param {Object} vmxPackage Package
     * @param {String} package.id Id
     * @param {String} package.description Description
     */
    async upsertPackage(vmxPackage) {
        let url = SMI_BASE_URL + '/smi/v1.0/packages/' + vmxPackage.id;

        delete vmxPackage.id;
        
        return await this.makeRequest({
            method: 'put',
            url: url,
            data: vmxPackage
        });
    }

    /**
     * Get package
     * @param {String} id Package id
     */
    async getPackage(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/packages/' + id;

        let result = await this.makeRequest({
            method: 'get',
            url: url
        });

        return result.data;
    }

    /**
     * Delete package
     * @param {String} id Package id
     */
    async deletePackage(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/packages/' + id;
        
        return await this.makeRequest({
            method: 'delete',
            url: url
        });
    }

    /**
     * Add package asset
     * @param {String} packageId Package id
     * @param {String} contentId Content id
     * @param {String} assetId Asset id
     */
    async addPackageAsset(packageId, contentId, assetId) {
        let url = SMI_BASE_URL + '/smi/v1.0/packages/' + packageId + '/content/' + contentId + '/asset/' + assetId + '?networkType=ITV';
        
        return await this.makeRequest({
            method: 'put',
            url: url
        });
    }

    /**
     * Add or update device
     * @param {Object} device Device
     * @param {String} device.id Id
     * @param {String} device.deviceType Device type
     * @param {String} device.networkType Network type
     * @param {String} device.verimatrixClientId Verimarix client id
     */
    async upsertDevice(device) {
        let url = SMI_BASE_URL + '/smi/v1.0/devices/' + device.id;

        delete device.id;
        
        return await this.makeRequest({
            method: 'put',
            url: url,
            data: device
        });
    }

    /**
     * Get device
     * @param {String} id Device id
     */
    async getDevice(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/devices/' + id;

        let result = await this.makeRequest({
            method: 'get',
            url: url
        });

        return result.data;
    }

    /**
     * Delete device
     * @param {String} id Device id
     */
    async deleteDevice(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/devices/' + id;

        return await this.makeRequest({
            method: 'delete',
            url: url
        });
    }

    /**
     * Add or update entitlement
     * @param {Object} entitlement Entitlement
     * @param {String} entitlement.id Id
     * @param {String} entitlement.packageId Package id
     * @param {String} entitlement.deviceId Device id
     * @param {Date} entitlement.startTime Start time
     * @param {Date} entitlement.endTime End time
     * @param {Object} entitlement.entitlementSettings Entitlement settings
     * @param {String} entitlement.entitlementSettings.LICENSE_TYPE License type
     * @param {Object} entitlement.entitlementSettings.PERSISTENCE_DURATION Persistence duration
     */
    async upsertEntitlement(entitlement) {
        let url = SMI_BASE_URL + '/smi/v1.0/entitlements/' + entitlement.id;
        if (!entitlement.entitlementSettings) {
            /*entitlement.entitlementSettings = {
                LICENSE_TYPE: "REGULAR",
		        PERSISTENCE_DURATION: "0"
            }*/
        }

        delete entitlement.id;
        
        return await this.makeRequest({
            method: 'put',
            url: url,
            data: entitlement
        });
    }

    /**
     * Get entitlement
     * @param {String} id Entitlement id
     */
    async getEntitlement(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/entitlements/' + id;

        let result = await this.makeRequest({
            method: 'get',
            url: url
        });

        return result.data;
    }

    /**
     * Delete entitlement
     * @param {String} id Entitlement id
     */
    async deleteEntitlement(id) {
        let url = SMI_BASE_URL + '/smi/v1.0/entitlements/' + id;

        return await this.makeRequest({
            method: 'delete',
            url: url
        });
    }

    refreshAuth(token) {
        let expire = new Date();
        expire.setMinutes(expire.getMinutes() + 45);

        this.tokenExpire = expire;

        this.token = token;
    }

    async makeRequest(options, skipAuth) {
        options.headers = Object.assign({}, this.headers);

        if (this.debug) {
            console.log(options);
        }

        if (!skipAuth) {
            let now = new Date();
            if (!this.tokenExpire || this.tokenExpire.getTime() - now.getTime() < 0) {
                await this.login();
            }

            options.headers.Authorization = this.token;
        }

        try {
            return await axios(options);
        }
        catch(err) {
            if (err.response.status == 401 && !skipAuth) {
                await this.login();

                options.headers.Authorization = this.token;

                return await axios(options);
            }
            else {
                throw err;
            }
        }
    }
}

module.exports = VmxClient;