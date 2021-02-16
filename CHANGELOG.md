# Changelog
## [Unreleased]


## [1.5.5] - 15/12/2020
### Fixed
- Fix package deletion issue at channels
- Fix genre deletion issue at tv series
- Refactored channel event api to use cache
- Removed subscription filter from feed api when the customer has no subscription
- Fix winston to use with transporters
- Fix settings problem with expiration date
- Fix apiv4 verify user middleware with promises
- Fix no company condition in public subscription apis
- etc...

### Added
- Add apiv4 endpoints
- Add apiv4 endpoint for auto login
- Add docker to magoware-backoffice
- Add web-app app id.
- Added app id 8
- Unified epg store for home page and channel event
- Added public api for getting last customer subscription
- Added api: /apiv2/channels/scheduled
- etc...

## [1.0.0] - 25/09/2020
### Added
- Changelog.
- Semver version commands.

[Unreleased]: https://bitbucket.org/magoware/magoware-backoffice/branch/develop
[1.0.0]: https://bitbucket.org/magoware/magoware-backoffice/src/v1.0.0/
[1.5.5]: https://bitbucket.org/magoware/magoware-backoffice/src/v1.5.5/